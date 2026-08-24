import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";
import { app, teardown } from "../helpers/app.js";
import { startServer, type TestServer } from "../helpers/server.js";
import { expectEnvelope, expectErrorShape, expectSortedBy } from "../helpers/assertions.js";

let server: TestServer;

before(async () => {
  server = await startServer(app);
});

after(async () => {
  await server.close();
  await teardown();
});

interface HealthReport {
  breakdown: {
    criticalStock: number;
    belowReorderPoint: number;
    expiringSoon: number;
    excessStock: number;
    healthy: number;
    total: number;
  };
  conditions: {
    belowSafetyStock: number;
    belowReorderPoint: number;
    aboveMaximum: number;
    expiringWithin30Days: number;
    expiringWithin90Days: number;
  };
  byCategory: { category: string; skuCount: number; inventoryValue: number; atRiskCount: number; expiringValue: number }[];
  byCriticality: { criticality: string; skuCount: number; atRiskCount: number; stockoutRisk: number }[];
}

const health = async (query = ""): Promise<HealthReport> =>
  expectEnvelope<HealthReport>(await server.json("/api/dashboard/inventory-health" + query)).data;

const firstWarehouseId = async (): Promise<string> => {
  const { data } = expectEnvelope<{ id: string }[]>(await server.json("/api/warehouses"));
  return data[0]!.id;
};

describe("GET /api/dashboard/inventory-health", () => {
  test("returns the four documented sections", async () => {
    const response = await server.get("/api/dashboard/inventory-health");
    assert.equal(response.status, 200);

    const { data } = expectEnvelope<HealthReport>(await response.json());
    assert.ok(data.breakdown);
    assert.ok(data.conditions);
    assert.ok(Array.isArray(data.byCategory));
    assert.ok(Array.isArray(data.byCriticality));
  });

  test("breakdown states are mutually exclusive and sum to the total", async () => {
    const { breakdown } = await health();
    const sum =
      breakdown.criticalStock +
      breakdown.belowReorderPoint +
      breakdown.expiringSoon +
      breakdown.excessStock +
      breakdown.healthy;

    assert.equal(
      sum,
      breakdown.total,
      "every position must land in exactly one state - a gap means a position was lost or double counted",
    );
  });

  test("breakdown counts are non-negative integers", async () => {
    const { breakdown } = await health();
    for (const [state, count] of Object.entries(breakdown)) {
      assert.ok(Number.isInteger(count), state + " must be an integer");
      assert.ok(count >= 0, state + " must not be negative");
    }
  });

  test("overlapping conditions are never smaller than their exclusive bucket", async () => {
    const { breakdown, conditions } = await health();

    assert.ok(
      conditions.belowReorderPoint >= breakdown.belowReorderPoint,
      "positions claimed by criticalStock must still be counted in the condition",
    );
    assert.ok(
      conditions.aboveMaximum >= breakdown.excessStock,
      "positions claimed by expiringSoon must still be counted in the condition",
    );
    assert.ok(conditions.belowSafetyStock >= breakdown.criticalStock);
  });

  test("criticalStock is the top of the priority chain, so nothing can be stolen from it", async () => {
    const { breakdown, conditions } = await health();
    assert.equal(
      breakdown.criticalStock,
      conditions.belowSafetyStock,
      "criticalStock is evaluated first, so it must capture every below-safety-stock position",
    );
  });

  test("the two shortage states together account for every below-reorder-point position", async () => {
    const { breakdown, conditions } = await health();
    assert.equal(
      breakdown.criticalStock + breakdown.belowReorderPoint,
      conditions.belowReorderPoint,
      "shortage outranks expiry and excess, so no shortage position may be claimed by a later state",
    );
  });

  test("expiry outranks excess, so overstock that is also expiring is reported as expiring", async () => {
    const { breakdown, conditions } = await health();
    const claimedByHigherPriority = conditions.aboveMaximum - breakdown.excessStock;

    assert.ok(claimedByHigherPriority >= 0, "excessStock cannot exceed the aboveMaximum condition");
    if (claimedByHigherPriority > 0) {
      assert.ok(
        breakdown.expiringSoon + breakdown.criticalStock + breakdown.belowReorderPoint >= claimedByHigherPriority,
        "positions missing from excessStock must be accounted for by a higher-priority state",
      );
    }
  });

  test("the safety-stock condition is a subset of the reorder-point condition", async () => {
    const { conditions } = await health();
    assert.ok(conditions.belowSafetyStock <= conditions.belowReorderPoint);
  });

  test("the 30-day expiry window is a subset of the 90-day window", async () => {
    const { conditions } = await health();
    assert.ok(conditions.expiringWithin30Days <= conditions.expiringWithin90Days);
  });

  test("no condition exceeds the number of positions", async () => {
    const { breakdown, conditions } = await health();
    for (const field of ["belowSafetyStock", "belowReorderPoint", "aboveMaximum"] as const) {
      assert.ok(conditions[field] <= breakdown.total, field + " exceeded the position count");
    }
  });

  test("categories are sorted by inventory value, descending", async () => {
    const { byCategory } = await health();
    assert.ok(byCategory.length > 0, "seed data is missing");
    expectSortedBy(byCategory, (row) => row.inventoryValue, "desc");
  });

  test("each category row is internally consistent", async () => {
    const { byCategory, breakdown } = await health();
    let positions = 0;

    for (const row of byCategory) {
      assert.equal(typeof row.category, "string");
      assert.ok(row.category.length > 0, "an uncategorised product must be labelled, not blank");
      assert.ok(row.skuCount > 0);
      assert.ok(row.inventoryValue >= 0);
      assert.ok(row.expiringValue >= 0);
      assert.ok(row.atRiskCount <= row.skuCount, row.category + " reported more at risk than it holds");
      positions += row.skuCount;
    }

    assert.equal(positions, breakdown.total, "every position must belong to exactly one category bucket");
  });

  test("criticality bands are ordered from most to least critical", async () => {
    const { byCriticality } = await health();
    const order = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
    const seen = byCriticality.map((row) => row.criticality);

    assert.deepEqual(
      seen,
      order.filter((level) => seen.includes(level)),
      "bands must always read CRITICAL to LOW",
    );
  });

  test("each criticality row is internally consistent", async () => {
    const { byCriticality, breakdown } = await health();
    let positions = 0;

    for (const row of byCriticality) {
      assert.ok(row.skuCount > 0);
      assert.ok(row.atRiskCount <= row.skuCount);
      assert.ok(row.stockoutRisk >= 0 && row.stockoutRisk <= 100);
      positions += row.skuCount;
    }

    assert.equal(positions, breakdown.total, "every position must belong to exactly one criticality band");
  });

  test("scoping to one warehouse narrows every figure", async () => {
    const network = await health();
    const scoped = await health("?warehouseId=" + (await firstWarehouseId()));

    assert.ok(scoped.breakdown.total > 0, "the seeded warehouse should hold stock");
    assert.ok(scoped.breakdown.total < network.breakdown.total, "one DC holds less than the whole network");
    assert.ok(scoped.conditions.expiringWithin90Days <= network.conditions.expiringWithin90Days);
  });

  test("a scoped report still balances", async () => {
    const { breakdown } = await health("?warehouseId=" + (await firstWarehouseId()));
    const sum =
      breakdown.criticalStock +
      breakdown.belowReorderPoint +
      breakdown.expiringSoon +
      breakdown.excessStock +
      breakdown.healthy;
    assert.equal(sum, breakdown.total);
  });

  test("an unknown warehouse is a 404, not a healthy empty report", async () => {
    const response = await server.get("/api/dashboard/inventory-health?warehouseId=does-not-exist");
    assert.equal(response.status, 404, "zeros would be indistinguishable from a real empty warehouse");

    const body = expectErrorShape(await response.json(), "NOT_FOUND");
    assert.ok(body.error.message.includes("does-not-exist"));
  });

  test("a blank warehouseId is rejected as invalid", async () => {
    const response = await server.get("/api/dashboard/inventory-health?warehouseId=");
    assert.equal(response.status, 422);
    expectErrorShape(await response.json(), "VALIDATION_FAILED");
  });
});
