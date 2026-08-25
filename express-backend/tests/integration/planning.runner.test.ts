import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, test } from "node:test";
import type { TestServer } from "../helpers/server.js";

// Set before anything reads the config: this suite is the one that wants runs to
// actually execute. Every other suite leaves the executor disabled.
process.env.RATE_LIMIT_ENABLED = "false";
process.env.PLANNING_EXECUTOR = "inline";

const { app } = await import("../../src/app.js");
const { prisma } = await import("../../src/config/prisma.js");
const { disconnectPrisma } = await import("../../src/config/prisma.js");
const { disconnectRedis } = await import("../../src/config/redis.js");
const { PLANNING } = await import("../../src/config/constants.js");
const { drainPlanning, inFlightRuns, scheduleRun } = await import("../../src/lib/planning-runner.js");
const { failAbandonedRuns } = await import("../../src/services/planning.service.js");
const { startServer } = await import("../helpers/server.js");

const HORIZON = 7;
const DRAIN_MS = 120_000;

let server: TestServer;

interface RunBody {
  data: {
    id: string;
    status: string;
    modelVersion: string | null;
    artifacts?: {
      forecasts: number;
      inventoryPlans: number;
      supplyPlans: number;
      drpPlans: number;
      recommendations: number;
      optimization: boolean;
      simulation: boolean;
    };
  };
}

// PlanningRun has no cascade on its artefact relations, so a run that produced
// forecasts cannot be deleted until they are. A bare deleteMany throws P2003 here.
const deleteRun = async (id: string) => {
  await prisma.recommendation.deleteMany({ where: { planningRunId: id } });
  await prisma.dRPPlan.deleteMany({ where: { planningRunId: id } });
  await prisma.supplyPlan.deleteMany({ where: { planningRunId: id } });
  await prisma.inventoryPlan.deleteMany({ where: { planningRunId: id } });
  await prisma.forecast.deleteMany({ where: { planningRunId: id } });
  await prisma.optimizationResult.deleteMany({ where: { planningRunId: id } });
  await prisma.simulationRun.deleteMany({ where: { planningRunId: id } });
  await prisma.planningRun.deleteMany({ where: { id } });
};

const clearRuns = async () => {
  for (const run of await prisma.planningRun.findMany({ select: { id: true } })) {
    await deleteRun(run.id);
  }
};

const postRun = async (headers?: Record<string, string>) => {
  const response = await server.post(
    "/api/planning/runs",
    { horizonDays: HORIZON },
    headers,
  );
  return { response, body: (await response.json()) as RunBody };
};

const detail = (id: string) => server.json<RunBody>(`/api/planning/runs/${id}`);

before(async () => {
  server = await startServer(app);
});

beforeEach(clearRuns);

after(async () => {
  await drainPlanning(DRAIN_MS);
  await clearRuns();
  await server.close();
  await Promise.allSettled([disconnectPrisma(), disconnectRedis()]);
});

describe("POST /api/planning/runs schedules execution", () => {
  test("the 202 comes back before the run has finished, and the run then completes", async () => {
    const { response, body } = await postRun();

    assert.equal(response.status, 202);
    assert.equal(body.data.status, "PENDING", "the response must not wait for the executor");
    assert.equal(inFlightRuns(), 1, "the run must be scheduled by the time the 202 is written");

    await drainPlanning(DRAIN_MS);
    assert.equal(inFlightRuns(), 0);

    const finished = await detail(body.data.id);
    assert.equal(finished.data.status, "COMPLETED");
    assert.ok(finished.data.modelVersion, "a completed run records which model produced it");

    const artifacts = finished.data.artifacts;
    assert.ok(artifacts, "the detail route must report artifact counts");
    assert.equal(
      artifacts.forecasts,
      await prisma.forecast.count({ where: { planningRunId: body.data.id } }),
      "reported counts must match the rows on disk",
    );
    assert.ok(artifacts.forecasts > 0, "a completed run without forecasts is not a plan");
    assert.equal(artifacts.inventoryPlans, artifacts.forecasts, "one plan per forecast point");
    assert.ok(artifacts.optimization, "the closing transaction must have written a cost roll-up");
    assert.ok(artifacts.simulation);
  });

  test("scheduling the same run twice executes it once", async () => {
    const user = await prisma.user.findFirstOrThrow({ select: { id: true } });
    const run = await prisma.planningRun.create({
      data: { horizonDays: HORIZON, createdById: user.id },
      select: { id: true },
    });

    scheduleRun(run.id);
    scheduleRun(run.id);
    assert.equal(inFlightRuns(), 1, "a duplicate schedule must not start a second execution");

    await drainPlanning(DRAIN_MS);

    const pairs = await prisma.inventory.count();
    const forecasts = await prisma.forecast.count({ where: { planningRunId: run.id } });
    assert.equal(forecasts, pairs * HORIZON, "artifacts must not be doubled");
  });

  test("an idempotency replay returns the original run without executing again", { skip: process.env.REDIS_URL ? false : "REDIS_URL is not set; idempotency is a no-op" }, async () => {
    const key = randomUUID();
    const { body: created } = await postRun({ "idempotency-key": key });
    await drainPlanning(DRAIN_MS);

    const before = await detail(created.data.id);
    const counts = before.data.artifacts;
    assert.ok(counts);

    const { response, body: replay } = await postRun({ "idempotency-key": key });
    assert.equal(response.status, 200, "a replay is not a new run");
    assert.equal(replay.data.id, created.data.id);
    assert.equal(inFlightRuns(), 0, "a replay must not schedule execution");

    const after = await detail(created.data.id);
    assert.deepEqual(after.data.artifacts, counts, "a replay must not double the artifacts");
  });
});

describe("shutdown and boot", () => {
  test("draining with nothing in flight is a no-op", async () => {
    assert.equal(inFlightRuns(), 0);
    await drainPlanning(DRAIN_MS);
  });

  test("a run left active by a previous process is failed at boot", async () => {
    const user = await prisma.user.findFirstOrThrow({ select: { id: true } });
    const stale = await prisma.planningRun.create({
      data: {
        horizonDays: HORIZON,
        createdById: user.id,
        status: "RUNNING",
        createdAt: new Date(Date.now() - PLANNING.runTimeoutMs - 60_000),
        startedAt: new Date(Date.now() - PLANNING.runTimeoutMs - 60_000),
      },
      select: { id: true },
    });

    const { count } = await failAbandonedRuns();
    assert.ok(count >= 1);

    const row = await prisma.planningRun.findUniqueOrThrow({
      where: { id: stale.id },
      select: { status: true, completedAt: true },
    });
    assert.equal(row.status, "FAILED", "a run nobody is executing must not sit at RUNNING forever");
    assert.ok(row.completedAt, "a failed run still needs an end time so it stops looking active");
  });
});
