import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";
import { app, teardown } from "../helpers/app.js";
import { startServer, type TestServer } from "../helpers/server.js";
import { expectEnvelope } from "../helpers/assertions.js";

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
    pendingRecommendations: number;
  };
  networkHealth: { atRiskSkuCount: number; excessInventoryValue: number; shortageValue: number; inStockPercentage: number };
}

interface WarehouseStats {
  id: string;
  code: string;
  skuCount: number;
  inventoryValue: number;
  belowReorderPointCount: number;
  belowSafetyStockCount: number;
  shortageValue: number;
  excessValue: number;
  expiringValue: number;
}

interface HealthReport {
  breakdown: { total: number };
  conditions: { belowSafetyStock: number; belowReorderPoint: number; aboveMaximum: number; expiringWithin90Days: number };
}

interface ExpiryReport {
  totals: { batchCount: number; valueAtRisk: number };
}

const load = async () => {
  const [summary, network, health, expiry] = await Promise.all([
    server.json("/api/dashboard/summary"),
    server.json("/api/dashboard/network"),
    server.json("/api/dashboard/inventory-health"),
    server.json("/api/dashboard/expiry-risk?pageSize=1"),
  ]);

  return {
    summary: expectEnvelope<Summary>(summary).data,
    network: expectEnvelope<WarehouseStats[]>(network).data,
    health: expectEnvelope<HealthReport>(health).data,
    expiry: expectEnvelope<ExpiryReport>(expiry).data,
  };
};

const sum = <T>(rows: T[], value: (row: T) => number) => rows.reduce((total, row) => total + value(row), 0);

describe("the same fact agrees across every route that reports it", () => {
  test("expiring batch counts agree across three routes", async () => {
    const { summary, health, expiry } = await load();

    assert.equal(
      summary.kpis.expiryRiskItems,
      expiry.totals.batchCount,
      "summary and expiry-risk disagree on how many batches are expiring",
    );
    assert.equal(
      health.conditions.expiringWithin90Days,
      expiry.totals.batchCount,
      "inventory-health and expiry-risk disagree on how many batches are expiring",
    );
  });

  test("below-reorder-point counts agree across three routes", async () => {
    const { summary, network, health } = await load();
    const networkTotal = sum(network, (row) => row.belowReorderPointCount);

    assert.equal(summary.kpis.stockoutRiskItems, networkTotal, "summary and network disagree");
    assert.equal(health.conditions.belowReorderPoint, networkTotal, "inventory-health and network disagree");
  });

  test("below-safety-stock counts agree across three routes", async () => {
    const { summary, network, health } = await load();
    const networkTotal = sum(network, (row) => row.belowSafetyStockCount);

    assert.equal(summary.networkHealth.atRiskSkuCount, networkTotal);
    assert.equal(health.conditions.belowSafetyStock, networkTotal);
  });

  test("position counts agree between network and inventory-health", async () => {
    const { network, health } = await load();
    assert.equal(
      sum(network, (row) => row.skuCount),
      health.breakdown.total,
      "the two routes disagree on how many positions exist",
    );
  });

  test("total inventory value agrees between summary and network", async () => {
    const { summary, network } = await load();
    const networkTotal = sum(network, (row) => row.inventoryValue);

    assert.ok(
      Math.abs(summary.kpis.totalInventoryValue - networkTotal) < 1,
      "summary reports " + summary.kpis.totalInventoryValue + " but the network sums to " + networkTotal,
    );
  });

  test("shortage and excess values agree between summary and network", async () => {
    const { summary, network } = await load();

    assert.ok(
      Math.abs(summary.networkHealth.shortageValue - sum(network, (row) => row.shortageValue)) < 1,
      "shortage value does not reconcile",
    );
    assert.ok(
      Math.abs(summary.networkHealth.excessInventoryValue - sum(network, (row) => row.excessValue)) < 1,
      "excess value does not reconcile",
    );
  });

  test("expiring value agrees between network and expiry-risk", async () => {
    const { network, expiry } = await load();

    assert.ok(
      Math.abs(sum(network, (row) => row.expiringValue) - expiry.totals.valueAtRisk) < 1,
      "the per-warehouse expiring values do not sum to the expiry-risk total",
    );
  });

  test("skus monitored never exceeds the number of positions", async () => {
    const { summary, health } = await load();
    assert.ok(
      summary.kpis.skusMonitored <= health.breakdown.total,
      "a product can hold several positions, so distinct products cannot exceed positions",
    );
  });

  test("in-stock percentage reconciles with the reorder-point count", async () => {
    const { summary, health } = await load();
    const inStock = health.breakdown.total - health.conditions.belowReorderPoint;
    const expected = (inStock / health.breakdown.total) * 100;

    assert.ok(
      Math.abs(summary.networkHealth.inStockPercentage - expected) < 0.02,
      "inStockPercentage " + summary.networkHealth.inStockPercentage + " does not match " + expected,
    );
  });

  test("scoping a route to each warehouse partitions the network total", async () => {
    const { network, health } = await load();
    let scopedTotal = 0;

    for (const warehouse of network) {
      const scoped = expectEnvelope<HealthReport>(
        await server.json("/api/dashboard/inventory-health?warehouseId=" + warehouse.id),
      ).data;
      assert.equal(
        scoped.breakdown.total,
        warehouse.skuCount,
        warehouse.code + ": scoped position count disagrees with the network row",
      );
      scopedTotal += scoped.breakdown.total;
    }

    assert.equal(scopedTotal, health.breakdown.total, "the warehouses must partition the network exactly");
  });
  test("pending recommendations agree between summary and the recommendations list", async () => {
    const { summary } = await load();
    const open = expectEnvelope<unknown[]>(
      await server.json("/api/recommendations?status=OPEN&pageSize=1"),
    );

    // Both must mean "open against the latest completed run". Counting the whole
    // table instead put every superseded run into the KPI, so the dashboard offered
    // 798 pending actions and the page it links to listed 200.
    assert.equal(
      summary.kpis.pendingRecommendations,
      open.meta?.total ?? 0,
      "summary reports " +
        summary.kpis.pendingRecommendations +
        " pending recommendations but the list totals " +
        (open.meta?.total ?? 0),
    );
  });
});
