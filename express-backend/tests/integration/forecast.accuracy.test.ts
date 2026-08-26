import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";

process.env.RATE_LIMIT_ENABLED = "false";
process.env.PLANNING_EXECUTOR = "disabled";

const { app } = await import("../../src/app.js");
const { prisma } = await import("../../src/config/prisma.js");
const { disconnectPrisma } = await import("../../src/config/prisma.js");
const { disconnectRedis } = await import("../../src/config/redis.js");
const { metricsOf } = await import("../../src/services/forecast-accuracy.service.js");
const { startServer } = await import("../helpers/server.js");
const { expectEnvelope, expectErrorShape } = await import("../helpers/assertions.js");

import type { TestServer } from "../helpers/server.js";

const MS_PER_DAY = 86_400_000;
const HORIZON = 5;

let server: TestServer;
let runId: string;

interface Metrics {
  scoredPoints: number;
  accuracyPercent: number | null;
  wapePercent: number | null;
  mapePercent: number | null;
  maePerDay: number | null;
  rmse: number | null;
  biasPercent: number | null;
}

interface Body extends Record<string, unknown> {
  planningRunId: string | null;
  overall: Metrics;
  groups: (Metrics & { id?: string; code?: string | null; horizonDay?: number })[];
  note: string | null;
  dataCaveat: string;
}

const get = (path: string) => server.json<unknown>(path).then((b) => expectEnvelope<Body>(b));

const deleteRun = async (id: string) => {
  for (const table of ["recommendation", "dRPPlan", "supplyPlan", "inventoryPlan", "forecast", "optimizationResult", "simulationRun"] as const) {
    await (prisma as unknown as Record<string, { deleteMany: (a: unknown) => Promise<unknown> }>)[table]!.deleteMany({
      where: { planningRunId: id },
    });
  }
  await prisma.planningRun.deleteMany({ where: { id } });
};

/**
 * A run whose horizon is already in the past.
 *
 * The executor only ever forecasts forward, so a naturally created run has nothing
 * to score. Writing forecast rows onto days that already have demand history is the
 * only way to exercise the measurement at all.
 */
before(async () => {
  server = await startServer(app);
  for (const run of await prisma.planningRun.findMany({ select: { id: true } })) {
    await deleteRun(run.id);
  }

  const user = await prisma.user.findFirstOrThrow({ select: { id: true } });
  const run = await prisma.planningRun.create({
    data: {
      horizonDays: HORIZON,
      createdById: user.id,
      status: "COMPLETED",
      modelVersion: "accuracy-test-model",
      startedAt: new Date(),
      completedAt: new Date(),
    },
    select: { id: true },
  });
  runId = run.id;

  // Take real demand from the recent past and forecast it with a known error, so
  // the expected metrics can be computed independently of the service.
  const actuals = await prisma.demandHistory.findMany({
    where: { date: { gte: new Date(Date.now() - 20 * MS_PER_DAY) } },
    select: { productId: true, warehouseId: true, date: true, orderedQuantity: true },
    orderBy: { date: "asc" },
    take: 400,
  });
  assert.ok(actuals.length > 0, "seed data is missing - run pnpm prisma:seed");

  await prisma.forecast.createMany({
    data: actuals.map((row) => ({
      planningRunId: runId,
      productId: row.productId,
      warehouseId: row.warehouseId,
      forecastDate: row.date,
      // Exactly 10% high, so WAPE must come out at 10 and bias at +10.
      p10: row.orderedQuantity * 0.9,
      p50: row.orderedQuantity * 1.1,
      p90: row.orderedQuantity * 1.3,
      modelVersion: "accuracy-test-model",
    })),
  });
});

after(async () => {
  if (runId) await deleteRun(runId);
  await server.close();
  await Promise.allSettled([disconnectPrisma(), disconnectRedis()]);
});

describe("metricsOf", () => {
  test("computes the standard measures from known errors", () => {
    const points = [
      { forecast: 110, actual: 100, productId: "p", warehouseId: "w", horizonDay: 1 },
      { forecast: 90, actual: 100, productId: "p", warehouseId: "w", horizonDay: 2 },
    ];
    const metrics = metricsOf(points);

    assert.equal(metrics.scoredPoints, 2);
    assert.equal(metrics.wapePercent, 10, "20 units of error over 200 units of demand");
    assert.equal(metrics.accuracyPercent, 90);
    assert.equal(metrics.maePerDay, 10);
    assert.equal(metrics.biasPercent, 0, "+10 and -10 cancel");
  });

  test("a zero actual is excluded from MAPE rather than dividing by it", () => {
    const points = [
      { forecast: 5, actual: 0, productId: "p", warehouseId: "w", horizonDay: 1 },
      { forecast: 110, actual: 100, productId: "p", warehouseId: "w", horizonDay: 2 },
    ];
    const metrics = metricsOf(points);

    assert.ok(Number.isFinite(metrics.mapePercent!), "MAPE must not divide by zero");
    assert.equal(metrics.mapeExcludedPoints, 1);
    assert.equal(metrics.scoredPoints, 2, "the point still counts toward WAPE and MAE");
  });

  test("nothing to score reports null, not zero", () => {
    const metrics = metricsOf([]);
    assert.equal(metrics.scoredPoints, 0);
    assert.equal(metrics.accuracyPercent, null, "0% accuracy would be a claim; null is the truth");
    assert.equal(metrics.wapePercent, null);
  });
});

describe("GET /api/forecast/accuracy", () => {
  test("scores a run against realised demand", async () => {
    const { data } = await get("/api/forecast/accuracy");

    assert.equal(data.planningRunId, runId);
    assert.ok(data.overall.scoredPoints > 0, "the run must have realised days to score");

    // The fixture forecasts every day exactly 10% high.
    assert.ok(
      Math.abs(data.overall.wapePercent! - 10) < 0.01,
      `expected WAPE 10, got ${data.overall.wapePercent}`,
    );
    assert.ok(Math.abs(data.overall.accuracyPercent! - 90) < 0.01);
    assert.ok(
      Math.abs(data.overall.biasPercent! - 10) < 0.01,
      "a forecast that runs high must report positive bias",
    );
  });

  test("carries the caveat that this data is generated", async () => {
    const { data } = await get("/api/forecast/accuracy");
    assert.match(
      data.dataCaveat,
      /generated/i,
      "a figure from seeded data must not be quotable as forecast skill without the caveat",
    );
  });

  test("groups by sku, warehouse and horizon", async () => {
    for (const groupBy of ["sku", "warehouse", "horizon"]) {
      const { data } = await get(`/api/forecast/accuracy?groupBy=${groupBy}`);
      assert.ok(data.groups.length > 0, `${groupBy} produced no groups`);

      const total = data.groups.reduce((sum, group) => sum + group.scoredPoints, 0);
      assert.equal(
        total,
        data.overall.scoredPoints,
        `${groupBy} groups must partition the scored points exactly once`,
      );
    }
  });

  test("sku and warehouse groups are labelled and ordered worst first", async () => {
    const { data } = await get("/api/forecast/accuracy?groupBy=warehouse");

    for (const group of data.groups) assert.ok(group.code, "a group needs a readable label");
    for (let i = 1; i < data.groups.length; i += 1) {
      assert.ok(
        (data.groups[i - 1]!.wapePercent ?? 0) >= (data.groups[i]!.wapePercent ?? 0),
        "the point of a breakdown is finding where the model struggles",
      );
    }
  });

  test("horizon groups are numbered from day 1 and ascend", async () => {
    const { data } = await get("/api/forecast/accuracy?groupBy=horizon");
    const days = data.groups.map((group) => group.horizonDay!);

    assert.equal(days[0], 1, "the first forecast day is day 1, not day 0");
    for (let i = 1; i < days.length; i += 1) assert.ok(days[i]! > days[i - 1]!);
  });

  test("narrowing to one warehouse scores fewer points", async () => {
    const all = await get("/api/forecast/accuracy");
    const one = await get("/api/forecast/accuracy?warehouse=DC-01");

    assert.ok(one.data.overall.scoredPoints > 0);
    assert.ok(one.data.overall.scoredPoints < all.data.overall.scoredPoints);
  });

  test("rejects an unknown grouping, sku or warehouse", async () => {
    assert.equal((await server.get("/api/forecast/accuracy?groupBy=colour")).status, 422);
    assert.equal((await server.get("/api/forecast/accuracy?sku=NOPE")).status, 404);
    assert.equal((await server.get("/api/forecast/accuracy?runId=NOPE")).status, 404);

    const response = await server.get("/api/forecast/accuracy?groupBy=colour");
    expectErrorShape(await response.json(), "VALIDATION_FAILED");
  });
});

describe("the dashboard KPI", () => {
  test("reports the same number the accuracy route does", async () => {
    const accuracy = await get("/api/forecast/accuracy");
    const summary = (await server.json("/api/dashboard/summary")) as {
      data: { kpis: { forecastAccuracy: number | null } };
    };

    assert.equal(
      summary.data.kpis.forecastAccuracy,
      accuracy.data.overall.accuracyPercent,
      "two screens quoting one measurement must not disagree",
    );
    assert.ok(summary.data.kpis.forecastAccuracy !== null, "it was hardcoded null before WP-19");
  });
});
