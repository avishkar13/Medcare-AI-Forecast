import { strict as assert } from "node:assert";
import { after, before, beforeEach, describe, test } from "node:test";
import { app, teardown } from "../helpers/app.js";
import { startServer, type TestServer } from "../helpers/server.js";
import { expectEnvelope, expectErrorShape, expectSortedBy, isIsoDate } from "../helpers/assertions.js";
import { prisma } from "../../src/config/prisma.js";
import { PLANNING } from "../../src/config/constants.js";

let server: TestServer;

const redisSkip = process.env.REDIS_URL ? false : "REDIS_URL is not set; idempotency is a no-op";

interface PlanningRun {
  id: string;
  status: string;
  horizonDays: number;
  modelVersion: string | null;
  scenario: { id: string; name: string } | null;
  createdById: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  durationSeconds: number | null;
  stale: boolean;
}

interface PlanningRunDetail extends PlanningRun {
  artifacts: {
    forecasts: number;
    inventoryPlans: number;
    supplyPlans: number;
    drpPlans: number;
    recommendations: number;
    optimization: boolean;
    simulation: boolean;
  };
}

const clearRuns = () => prisma.planningRun.deleteMany({});

const createRun = async (body?: unknown, headers?: Record<string, string>) => {
  const response = await server.post("/api/planning/runs", body, headers);
  return { response, body: await response.json() };
};

before(async () => {
  server = await startServer(app);
});

beforeEach(clearRuns);

after(async () => {
  await clearRuns();
  await server.close();
  await teardown();
});

describe("POST /api/planning/runs", () => {
  test("creates a PENDING run and answers 202", async () => {
    const { response, body } = await createRun();
    assert.equal(response.status, 202);

    const { data, meta } = expectEnvelope<PlanningRun>(body);
    assert.equal(data.status, "PENDING");
    assert.equal(data.horizonDays, 30, "the documented default horizon");
    assert.equal(data.startedAt, null);
    assert.equal(data.completedAt, null);
    assert.equal(data.durationSeconds, null);
    assert.equal(data.stale, false);
    assert.equal(data.scenario, null);
    assert.ok(isIsoDate(data.createdAt));
    assert.equal(meta.planningRunId, data.id, "meta must carry the run id");
  });

  test("points Location at the run it created", async () => {
    const { response, body } = await createRun();
    const { data } = expectEnvelope<PlanningRun>(body);
    assert.equal(response.headers.get("location"), "/api/planning/runs/" + data.id);
  });

  test("accepts an explicit horizon and model version", async () => {
    const { response, body } = await createRun({ horizonDays: 90, modelVersion: "baseline-v2" });
    assert.equal(response.status, 202);

    const { data } = expectEnvelope<PlanningRun>(body);
    assert.equal(data.horizonDays, 90);
    assert.equal(data.modelVersion, "baseline-v2");
  });

  test("refuses a second run while one is active", async () => {
    const first = await createRun();
    assert.equal(first.response.status, 202);
    const { data } = expectEnvelope<PlanningRun>(first.body);

    const second = await createRun();
    assert.equal(second.response.status, 409);

    const { error } = expectErrorShape(second.body, "CONFLICT");
    const details = error.details as { activeRunId: string; status: string };
    assert.equal(details.activeRunId, data.id, "the conflict must name the run that blocks it");
    assert.equal(details.status, "PENDING");
  });

  test("allows a new run once the active one is no longer active", async () => {
    const { body } = await createRun();
    const { data } = expectEnvelope<PlanningRun>(body);

    await prisma.planningRun.update({
      where: { id: data.id },
      data: { status: "COMPLETED", startedAt: new Date(), completedAt: new Date() },
    });

    const next = await createRun();
    assert.equal(next.response.status, 202);
  });

  test("treats a run older than the timeout as abandoned and fails it", async () => {
    const user = await prisma.user.findFirst({ select: { id: true } });
    assert.ok(user, "seed data is missing - run pnpm prisma:seed");

    const abandoned = await prisma.planningRun.create({
      data: {
        horizonDays: 30,
        createdById: user.id,
        createdAt: new Date(Date.now() - PLANNING.runTimeoutMs - 60_000),
      },
      select: { id: true },
    });

    const { response } = await createRun();
    assert.equal(response.status, 202, "an abandoned run must not block a new one");

    const previous = await prisma.planningRun.findUniqueOrThrow({
      where: { id: abandoned.id },
      select: { status: true, completedAt: true },
    });
    assert.equal(previous.status, "FAILED");
    assert.ok(previous.completedAt, "an abandoned run must be closed out, not left open");
  });

  test("reports an abandoned run as stale before anything reaps it", async () => {
    const user = await prisma.user.findFirstOrThrow({ select: { id: true } });
    const { id } = await prisma.planningRun.create({
      data: {
        horizonDays: 30,
        createdById: user.id,
        createdAt: new Date(Date.now() - PLANNING.runTimeoutMs - 60_000),
      },
      select: { id: true },
    });

    const { data } = expectEnvelope<PlanningRunDetail>(await server.json("/api/planning/runs/" + id));
    assert.equal(data.status, "PENDING", "a read must not mutate the run");
    assert.equal(data.stale, true);
  });

  test("rejects a horizon outside the documented bounds", async () => {
    for (const horizonDays of [0, -1, 366]) {
      const { response, body } = await createRun({ horizonDays });
      assert.equal(response.status, 422, "horizonDays=" + horizonDays + " should be rejected");

      const { error } = expectErrorShape(body, "VALIDATION_FAILED");
      const paths = (error.details as { path: string }[]).map((issue) => issue.path);
      assert.ok(paths.includes("horizonDays"), "expected an issue on horizonDays, got " + JSON.stringify(paths));
    }
  });

  test("rejects a non-integer horizon", async () => {
    const { response } = await createRun({ horizonDays: 30.5 });
    assert.equal(response.status, 422);
  });

  test("rejects an unknown field rather than silently dropping it", async () => {
    const { response, body } = await createRun({ horizonDays: 30, iterations: 1000 });
    assert.equal(response.status, 422);
    expectErrorShape(body, "VALIDATION_FAILED");
  });

  test("rejects malformed JSON", async () => {
    const response = await fetch(server.url + "/api/planning/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ not json",
    });
    assert.equal(response.status, 400);
    expectErrorShape(await response.json(), "MALFORMED_JSON");
  });

  test("404s on a scenario that does not exist", async () => {
    const { response, body } = await createRun({ scenarioId: "no-such-scenario" });
    assert.equal(response.status, 404);
    expectErrorShape(body, "NOT_FOUND");
  });

  test("attaches a real scenario and echoes it back", async () => {
    const scenario = await prisma.scenario.findFirst({ select: { id: true, name: true } });
    assert.ok(scenario, "no Scenario exists - run pnpm prisma:seed");

    const { response, body } = await createRun({ scenarioId: scenario.id });
    assert.equal(response.status, 202);

    const { data } = expectEnvelope<PlanningRun>(body);
    assert.deepEqual(data.scenario, scenario, "the run must inline the scenario it was created for");
  });

  test("rejects an Idempotency-Key that is too short to be unique", async () => {
    const { response, body } = await createRun({}, { "idempotency-key": "short" });
    assert.equal(response.status, 422);
    expectErrorShape(body, "VALIDATION_FAILED");
  });

  test("replays the first run for a repeated Idempotency-Key", { skip: redisSkip }, async () => {
    const key = "test-idem-" + Date.now();

    const first = await createRun({ horizonDays: 45 }, { "idempotency-key": key });
    assert.equal(first.response.status, 202);
    const created = expectEnvelope<PlanningRun>(first.body).data;

    const replay = await createRun({ horizonDays: 45 }, { "idempotency-key": key });
    assert.equal(replay.response.status, 200, "a replay is not a fresh creation");

    const replayed = expectEnvelope<PlanningRun>(replay.body).data;
    assert.equal(replayed.id, created.id, "the same key must return the same run");

    const total = await prisma.planningRun.count();
    assert.equal(total, 1, "a replayed key must not create a second run");
  });

  test("does not burn an Idempotency-Key on a rejected request", { skip: redisSkip }, async () => {
    const key = "test-idem-fail-" + Date.now();

    const rejected = await createRun({ scenarioId: "no-such-scenario" }, { "idempotency-key": key });
    assert.equal(rejected.response.status, 404);

    const retried = await createRun({}, { "idempotency-key": key });
    assert.equal(retried.response.status, 202, "the key must be reusable after a failure");
  });
});

describe("GET /api/planning/runs", () => {
  test("returns a paginated envelope", async () => {
    const response = await server.get("/api/planning/runs");
    assert.equal(response.status, 200);

    const { data, meta } = expectEnvelope<PlanningRun[]>(await response.json());
    assert.ok(Array.isArray(data));
    assert.equal(meta.page, 1);
    assert.equal(meta.pageSize, 20);
    assert.equal(typeof meta.total, "number");
  });

  test("lists newest first", async () => {
    const user = await prisma.user.findFirstOrThrow({ select: { id: true } });
    const now = Date.now();

    await prisma.planningRun.createMany({
      data: [0, 1, 2].map((offset) => ({
        horizonDays: 30,
        createdById: user.id,
        status: "COMPLETED" as const,
        createdAt: new Date(now - offset * 60_000),
      })),
    });

    const { data, meta } = expectEnvelope<PlanningRun[]>(await server.json("/api/planning/runs"));
    assert.equal(meta.total, 3);
    expectSortedBy(data, (run) => Date.parse(run.createdAt), "desc");
  });

  test("filters by status", async () => {
    const user = await prisma.user.findFirstOrThrow({ select: { id: true } });
    await prisma.planningRun.createMany({
      data: [
        { horizonDays: 30, createdById: user.id, status: "COMPLETED" as const },
        { horizonDays: 30, createdById: user.id, status: "FAILED" as const },
      ],
    });

    const { data, meta } = expectEnvelope<PlanningRun[]>(
      await server.json("/api/planning/runs?status=FAILED"),
    );
    assert.equal(meta.total, 1);
    assert.equal(data.length, 1);
    assert.equal(data[0]!.status, "FAILED");
  });

  test("rejects a status outside the enum", async () => {
    const response = await server.get("/api/planning/runs?status=ABANDONED");
    assert.equal(response.status, 422);
    expectErrorShape(await response.json(), "VALIDATION_FAILED");
  });

  test("caps pageSize", async () => {
    const response = await server.get("/api/planning/runs?pageSize=500");
    assert.equal(response.status, 422);
  });

  test("reports a duration only once a run has both timestamps", async () => {
    const user = await prisma.user.findFirstOrThrow({ select: { id: true } });
    const startedAt = new Date(Date.now() - 120_000);

    await prisma.planningRun.create({
      data: {
        horizonDays: 30,
        createdById: user.id,
        status: "COMPLETED",
        startedAt,
        completedAt: new Date(startedAt.getTime() + 90_000),
      },
    });

    const { data } = expectEnvelope<PlanningRun[]>(await server.json("/api/planning/runs"));
    assert.equal(data[0]!.durationSeconds, 90);
  });
});

describe("GET /api/planning/runs/:id", () => {
  test("returns the run with an empty artifact count", async () => {
    const { body } = await createRun();
    const { data: created } = expectEnvelope<PlanningRun>(body);

    const response = await server.get("/api/planning/runs/" + created.id);
    assert.equal(response.status, 200);

    const { data, meta } = expectEnvelope<PlanningRunDetail>(await response.json());
    assert.equal(data.id, created.id);
    assert.equal(meta.planningRunId, created.id);
    assert.deepEqual(data.artifacts, {
      forecasts: 0,
      inventoryPlans: 0,
      supplyPlans: 0,
      drpPlans: 0,
      recommendations: 0,
      optimization: false,
      simulation: false,
    });
  });

  test("agrees with the list route about the same run", async () => {
    const { body } = await createRun({ horizonDays: 14 });
    const { data: created } = expectEnvelope<PlanningRun>(body);

    const { data: list } = expectEnvelope<PlanningRun[]>(await server.json("/api/planning/runs"));
    const listed = list.find((run) => run.id === created.id);
    assert.ok(listed, "the created run is missing from the list route");

    const { data: detail } = expectEnvelope<PlanningRunDetail>(
      await server.json("/api/planning/runs/" + created.id),
    );
    assert.equal(listed.status, detail.status);
    assert.equal(listed.horizonDays, detail.horizonDays);
    assert.equal(listed.createdAt, detail.createdAt);
  });

  test("404s on an unknown id", async () => {
    const response = await server.get("/api/planning/runs/does-not-exist");
    assert.equal(response.status, 404);
    expectErrorShape(await response.json(), "NOT_FOUND");
  });
});
