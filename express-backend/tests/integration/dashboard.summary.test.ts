import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";
import { app, teardown } from "../helpers/app.js";
import { startServer, type TestServer } from "../helpers/server.js";
import { expectEnvelope } from "../helpers/assertions.js";
import { prisma } from "../../src/config/prisma.js";

let server: TestServer;

before(async () => {
  server = await startServer(app);
});

after(async () => {
  await server.close();
  await teardown();
});

interface Summary {
  kpis: {
    totalInventoryValue: number;
    skusMonitored: number;
    stockoutRiskItems: number;
    expiryRiskItems: number;
    onTimeDeliveryRate: number | null;
    forecastAccuracy: number | null;
    activeAlerts: number;
    pendingRecommendations: number;
  };
  networkHealth: {
    overallScore: number;
    inStockPercentage: number;
    atRiskSkuCount: number;
    excessInventoryValue: number;
    shortageValue: number;
  };
}

const summary = async (): Promise<Summary> =>
  expectEnvelope<Summary>(await server.json("/api/dashboard/summary")).data;

/**
 * The sidebar badge beside "Alerts" carries this number, so it has to be the number of
 * alerts. It used to be `belowSafetyStock + criticalExpiryItems` - a count of inventory
 * positions with expiry folded in - which happened to read 7 beside a list of 8.
 */
describe("activeAlerts counts alerts", () => {
  test("matches the alert list for the same scope", async () => {
    const [summary, list] = await Promise.all([
      server.json<{ data: { kpis: { activeAlerts: number } } }>("/api/dashboard/summary"),
      server.json<{ meta: { total: number } }>("/api/alerts?status=open&pageSize=200"),
    ]);

    assert.equal(
      summary.data.kpis.activeAlerts,
      list.meta.total,
      "the badge must count open alerts, not inventory positions",
    );
  });

  test("narrows with the warehouse, like the list does", async () => {
    const warehouse = await prisma.warehouse.findFirst({ select: { id: true } });
    if (!warehouse) return;

    const [summary, list] = await Promise.all([
      server.json<{ data: { kpis: { activeAlerts: number } } }>(
        `/api/dashboard/summary?warehouseId=${warehouse.id}`,
      ),
      server.json<{ meta: { total: number } }>(
        `/api/alerts?status=open&pageSize=200&warehouseId=${warehouse.id}`,
      ),
    ]);

    assert.equal(summary.data.kpis.activeAlerts, list.meta.total);
  });
});

describe("GET /api/dashboard/summary", () => {
  test("returns both payloads in one response", async () => {
    const response = await server.get("/api/dashboard/summary");
    assert.equal(response.status, 200);

    const { data } = expectEnvelope<Summary>(await response.json());
    assert.ok(data.kpis, "kpis is missing");
    assert.ok(data.networkHealth, "networkHealth is missing");
  });

  test("every kpi is a number except the two that have no data source", async () => {
    const { kpis } = await summary();

    for (const field of [
      "totalInventoryValue",
      "skusMonitored",
      "stockoutRiskItems",
      "expiryRiskItems",
      "activeAlerts",
      "pendingRecommendations",
    ] as const) {
      assert.equal(typeof kpis[field], "number", field + " must be a number");
      assert.ok(Number.isFinite(kpis[field] as number), field + " must be finite");
      assert.ok((kpis[field] as number) >= 0, field + " must not be negative");
    }
  });

  test("reports missing metrics as null rather than inventing a plausible figure", async () => {
    const { kpis } = await summary();
    assert.equal(kpis.onTimeDeliveryRate, null, "no purchase-order model exists to compute this");
    assert.equal(kpis.forecastAccuracy, null, "no completed planning run exists to compute this");
  });

  test("counts are whole numbers", async () => {
    const { kpis } = await summary();
    for (const field of ["skusMonitored", "stockoutRiskItems", "expiryRiskItems", "activeAlerts"] as const) {
      assert.ok(Number.isInteger(kpis[field]), field + " counts things, so it must be an integer");
    }
  });

  test("network health percentages stay inside 0-100", async () => {
    const { networkHealth } = await summary();
    for (const field of ["overallScore", "inStockPercentage"] as const) {
      assert.ok(networkHealth[field] >= 0, field + " fell below 0");
      assert.ok(networkHealth[field] <= 100, field + " exceeded 100");
    }
  });

  test("network health values are non-negative", async () => {
    const { networkHealth } = await summary();
    assert.ok(networkHealth.atRiskSkuCount >= 0);
    assert.ok(networkHealth.excessInventoryValue >= 0);
    assert.ok(networkHealth.shortageValue >= 0);
  });

  test("the stricter safety-stock count never exceeds the reorder-point count", async () => {
    const { kpis, networkHealth } = await summary();
    assert.ok(
      networkHealth.atRiskSkuCount <= kpis.stockoutRiskItems,
      "below safety stock is a subset of below reorder point",
    );
  });

  test("pendingRecommendations is zero until the planning engine runs", async () => {
    const { kpis } = await summary();
    assert.equal(kpis.pendingRecommendations, 0, "no PlanningRun exists yet, so there is nothing open");
  });

  test("holds real seeded data rather than an empty network", async () => {
    const { kpis } = await summary();
    assert.ok(kpis.skusMonitored > 0, "seed data is missing - run pnpm prisma:seed");
    assert.ok(kpis.totalInventoryValue > 0);
  });

  test("is stable across consecutive calls", async () => {
    const first = await summary();
    const second = await summary();
    assert.deepEqual(first.kpis.skusMonitored, second.kpis.skusMonitored);
    assert.deepEqual(first.kpis.stockoutRiskItems, second.kpis.stockoutRiskItems);
  });
});
