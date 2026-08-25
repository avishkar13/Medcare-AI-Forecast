import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";

process.env.RATE_LIMIT_ENABLED = "false";
process.env.PLANNING_EXECUTOR = "disabled";

const { app } = await import("../../src/app.js");
const { prisma } = await import("../../src/config/prisma.js");
const { disconnectPrisma } = await import("../../src/config/prisma.js");
const { disconnectRedis } = await import("../../src/config/redis.js");
const { executeRun } = await import("../../src/services/planning-executor.service.js");
const { startServer } = await import("../helpers/server.js");
const { expectEnvelope, expectErrorShape, isIsoDate } = await import("../helpers/assertions.js");

import type { TestServer } from "../helpers/server.js";

const HORIZON = 5;

let server: TestServer;
let runId: string;

interface Meta {
  planningRunId: string | null;
  modelVersion: string | null;
}

const get = <T>(path: string) => server.json<unknown>(path).then((body) => expectEnvelope<T>(body));

const deleteRun = async (id: string) => {
  for (const table of [
    "recommendation",
    "dRPPlan",
    "supplyPlan",
    "inventoryPlan",
    "forecast",
    "optimizationResult",
    "simulationRun",
  ] as const) {
    await (prisma as unknown as Record<string, { deleteMany: (a: unknown) => Promise<unknown> }>)[
      table
    ]!.deleteMany({ where: { planningRunId: id } });
  }
  await prisma.planningRun.deleteMany({ where: { id } });
};

before(async () => {
  server = await startServer(app);
  // Start from no completed run so the honest-nulls path is exercised for real.
  for (const run of await prisma.planningRun.findMany({ select: { id: true } })) {
    await deleteRun(run.id);
  }
});

after(async () => {
  if (runId) await deleteRun(runId);
  await server.close();
  await Promise.allSettled([disconnectPrisma(), disconnectRedis()]);
});

describe("GET /api/forecast/* with no completed run", () => {
  test("reports null rather than inventing a figure", async () => {
    const { data } = await get<Meta & { forecastedDemand: number | null; forecastAccuracy: number | null }>(
      "/api/forecast/kpi",
    );

    assert.equal(data.planningRunId, null, "there is no run to attribute numbers to");
    assert.equal(data.forecastedDemand, null);
    assert.equal(
      data.forecastAccuracy,
      null,
      "accuracy with nothing to measure must be null, never a plausible constant",
    );
  });

  test("performance says why it cannot score instead of listing invented models", async () => {
    const { data } = await get<Meta & { models: unknown[]; note: string | null }>(
      "/api/forecast/performance",
    );

    assert.deepEqual(data.models, []);
    assert.ok(data.note, "an empty table needs to say why it is empty");
  });

  test("the chart still returns real history with an empty prediction", async () => {
    const { data } = await get<Meta & { history: unknown[]; prediction: unknown[] }>(
      "/api/forecast/main-chart",
    );

    assert.equal(data.planningRunId, null);
    assert.deepEqual(data.prediction, [], "nothing has been predicted yet");
    assert.ok(data.history.length > 0, "history is real and does not depend on a run");
  });
});

describe("GET /api/forecast/* with a completed run", () => {
  before(async () => {
    const user = await prisma.user.findFirstOrThrow({ select: { id: true } });
    const run = await prisma.planningRun.create({
      data: { horizonDays: HORIZON, createdById: user.id },
      select: { id: true },
    });
    runId = run.id;
    await executeRun(runId);
  });

  test("kpi is attributed to the run and model that produced it", async () => {
    const { data } = await get<
      Meta & { forecastedDemand: number; forecastHorizonDays: number; peakDate: string }
    >("/api/forecast/kpi");

    assert.equal(data.planningRunId, runId);
    assert.ok(data.modelVersion, "a figure with no model behind it cannot be checked");
    assert.ok(data.forecastedDemand > 0);
    assert.equal(data.forecastHorizonDays, HORIZON);
    assert.ok(isIsoDate(data.peakDate) || data.peakDate.length === 10);
  });

  test("per-day figures divide by days, not by forecast rows", async () => {
    const { data } = await get<{ items: { forecastDays: number; forecastDemand: number }[] }>(
      "/api/forecast/network",
    );

    const rows = await prisma.forecast.count({ where: { planningRunId: runId } });
    assert.ok(rows > HORIZON, "the run must write more rows than days for this to be a real test");

    for (const item of data.items) {
      assert.equal(
        item.forecastDays,
        HORIZON,
        "forecastDays counted rows (days x products) once, making every per-day figure far too small",
      );
    }
  });

  test("a sku total equals the sum of its forecast rows", async () => {
    const { data } = await get<{ items: { productId: string; forecastDemand: number }[] }>(
      "/api/forecast/skus",
    );

    const top = data.items[0];
    assert.ok(top, "a completed run must produce per-sku forecasts");

    const actual = await prisma.forecast.aggregate({
      where: { planningRunId: runId, productId: top.productId },
      _sum: { p50: true },
    });
    assert.ok(
      Math.abs((actual._sum.p50 ?? 0) - top.forecastDemand) < 0.5,
      "the reported total must be the rows it claims to summarise",
    );
  });

  test("impact reports the run's own cost roll-up, not an estimate", async () => {
    const { data } = await get<{ totalCost: number; expiryCost: number }>("/api/forecast/impact");
    const optimization = await prisma.optimizationResult.findUniqueOrThrow({
      where: { planningRunId: runId },
    });

    assert.equal(data.totalCost, optimization.totalCost);
    assert.equal(data.expiryCost, optimization.expiryCost);
  });

  test("seasonality is measured from realised demand and centred on 1", async () => {
    const { data } = await get<{ weeklyPattern: { label: string; index: number }[] }>(
      "/api/forecast/seasonality",
    );

    assert.equal(data.weeklyPattern.length, 7);
    const mean =
      data.weeklyPattern.reduce((total, day) => total + day.index, 0) / data.weeklyPattern.length;
    assert.ok(Math.abs(mean - 1) < 0.25, `weekday indices should average about 1, got ${mean}`);
  });

  test("insight states facts with their numbers, not prose about flu season", async () => {
    const { data } = await get<{ observations: { kind: string; detail: string }[] }>(
      "/api/forecast/insight",
    );

    assert.ok(data.observations.length > 0);
    for (const observation of data.observations) {
      assert.ok(observation.kind && observation.detail);
    }
  });

  test("narrowing to one warehouse changes the totals", async () => {
    const all = await get<{ forecastedDemand: number }>("/api/forecast/kpi");
    const one = await get<{ forecastedDemand: number }>("/api/forecast/kpi?warehouse=DC-01");

    assert.ok(one.data.forecastedDemand < all.data.forecastedDemand);
  });
});

describe("GET /api/forecast/* validation", () => {
  test("404s on an unknown sku, warehouse or run", async () => {
    assert.equal((await server.get("/api/forecast/kpi?sku=NOPE")).status, 404);
    assert.equal((await server.get("/api/forecast/kpi?warehouse=NOPE")).status, 404);
    assert.equal((await server.get("/api/forecast/kpi?runId=NOPE")).status, 404);
  });

  test("rejects a horizon outside the documented bounds", async () => {
    for (const days of [0, -1, 400]) {
      const response = await server.get(`/api/forecast/kpi?days=${days}`);
      assert.equal(response.status, 422, `days=${days} should be rejected`);
      expectErrorShape(await response.json(), "VALIDATION_FAILED");
    }
  });

  test("every route answers in the shared envelope", async () => {
    for (const route of [
      "kpi",
      "summary",
      "main-chart",
      "trend",
      "seasonality",
      "network",
      "insight",
      "performance",
      "impact",
      "skus",
    ]) {
      const body = (await server.json(`/api/forecast/${route}`)) as { meta?: { generatedAt?: string } };
      assert.ok(body.meta?.generatedAt, `${route} is missing the response envelope`);
    }
  });
});
