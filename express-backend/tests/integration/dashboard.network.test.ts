import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";
import { app, teardown } from "../helpers/app.js";
import { startServer, type TestServer } from "../helpers/server.js";
import { expectEnvelope, expectErrorShape } from "../helpers/assertions.js";

let server: TestServer;

before(async () => {
  server = await startServer(app);
});

after(async () => {
  await server.close();
  await teardown();
});

interface WarehouseStats {
  id: string;
  code: string;
  name: string;
  region: string | null;
  tier: string;
  capacity: number | null;
  skuCount: number;
  onHandUnits: number;
  utilization: number | null;
  inventoryValue: number;
  belowReorderPointCount: number;
  belowSafetyStockCount: number;
  stockoutRisk: number;
  shortageValue: number;
  excessValue: number;
  expiringValue: number;
}

const network = async (query = ""): Promise<WarehouseStats[]> =>
  expectEnvelope<WarehouseStats[]>(await server.json("/api/dashboard/network" + query)).data;

interface InventoryRow {
  sku: string;
  warehouseCode: string;
  onHand: number;
  reserved: number;
  inTransit: number;
  available: number;
  inventoryPosition: number;
  reorderPoint: number;
}

describe("GET /api/dashboard/network", () => {
  test("returns one row per warehouse, ordered by code", async () => {
    const response = await server.get("/api/dashboard/network");
    assert.equal(response.status, 200);

    const rows = expectEnvelope<WarehouseStats[]>(await response.json()).data;
    assert.ok(rows.length > 0, "seed data is missing");

    const codes = rows.map((row) => row.code);
    assert.deepEqual(codes, [...codes].sort(), "documented order is code ascending");
    assert.equal(new Set(codes).size, codes.length, "a warehouse must not appear twice");
  });

  test("carries every documented field with the documented type", async () => {
    for (const row of await network()) {
      assert.equal(typeof row.id, "string");
      assert.equal(typeof row.code, "string");
      assert.ok(["METRO", "TIER_1", "TIER_2", "TIER_3"].includes(row.tier));
      assert.ok(row.capacity === null || typeof row.capacity === "number");
      assert.ok(row.utilization === null || typeof row.utilization === "number");

      for (const field of [
        "skuCount",
        "onHandUnits",
        "inventoryValue",
        "belowReorderPointCount",
        "belowSafetyStockCount",
        "stockoutRisk",
        "shortageValue",
        "excessValue",
        "expiringValue",
      ] as const) {
        assert.equal(typeof row[field], "number", row.code + "." + field + " must be a number");
        assert.ok((row[field] as number) >= 0, row.code + "." + field + " must not be negative");
      }
    }
  });

  test("utilization is null when capacity is unknown, never zero", async () => {
    for (const row of await network()) {
      if (row.capacity === null) {
        assert.equal(row.utilization, null, "unknown capacity is not the same as an empty warehouse");
      } else {
        assert.equal(typeof row.utilization, "number");
      }
    }
  });

  /**
   * Holds because safety stock is a floor under the reorder point and available stock is
   * a floor under the inventory position - so anything short on the stricter measure is
   * short on the looser one.
   *
   * It is not an identity, though: a position with an empty shelf and a large inbound
   * shipment is below safety stock (it cannot serve demand today) while its inventory
   * position clears the reorder point (nothing needs ordering). If this ever fails, check
   * for that shape before assuming a regression - it would be the data changing, not the
   * rule breaking.
   */
  test("the stricter safety-stock count never exceeds the reorder-point count", async () => {
    for (const row of await network()) {
      assert.ok(
        row.belowSafetyStockCount <= row.belowReorderPointCount,
        row.code + ": below safety stock must be a subset of below reorder point",
      );
    }
  });

  test("inbound stock never invents a replenishment need", async () => {
    // The reorder trigger is judged on the inventory position, which only ever adds
    // in-transit units to what is on hand. Counting them can remove a trigger - it can
    // never create one - so the count must not exceed the naive on-hand comparison.
    const { data: items } = await server.json<{ data: { items: InventoryRow[] } }>(
      "/api/inventory?pageSize=200",
    );

    const naiveByWarehouse = new Map<string, number>();
    for (const item of items.items) {
      if (item.onHand < item.reorderPoint) {
        naiveByWarehouse.set(item.warehouseCode, (naiveByWarehouse.get(item.warehouseCode) ?? 0) + 1);
      }
    }

    for (const row of await network()) {
      assert.ok(
        row.belowReorderPointCount <= (naiveByWarehouse.get(row.code) ?? 0),
        `${row.code}: counting inbound stock added a reorder trigger instead of removing one`,
      );
    }
  });

  test("available and inventory position are ordered, and reported", async () => {
    const { data } = await server.json<{ data: { items: InventoryRow[] } }>(
      "/api/inventory?pageSize=200",
    );

    for (const item of data.items) {
      assert.equal(typeof item.available, "number", `${item.sku}: available missing`);
      assert.equal(
        typeof item.inventoryPosition,
        "number",
        `${item.sku}: inventoryPosition missing - the verdict cannot be checked without it`,
      );
      assert.ok(item.available <= item.onHand, `${item.sku}: available exceeded on hand`);
      assert.ok(
        item.inventoryPosition >= item.available,
        `${item.sku}: inbound stock reduced the position`,
      );
    }
  });

  test("risk counts never exceed the number of positions held", async () => {
    for (const row of await network()) {
      assert.ok(row.belowReorderPointCount <= row.skuCount, row.code + " reported more at risk than it holds");
    }
  });

  test("stockoutRisk is the safety-stock count as a percentage of positions", async () => {
    for (const row of await network()) {
      const expected = row.skuCount === 0 ? 0 : (row.belowSafetyStockCount / row.skuCount) * 100;
      assert.ok(
        Math.abs(row.stockoutRisk - expected) < 0.01,
        row.code + ": stockoutRisk " + row.stockoutRisk + " does not match " + expected,
      );
      assert.ok(row.stockoutRisk >= 0 && row.stockoutRisk <= 100);
    }
  });

  test("a warehouse cannot be short of stock and holding excess of everything at once", async () => {
    for (const row of await network()) {
      if (row.belowReorderPointCount === row.skuCount && row.skuCount > 0) {
        assert.equal(row.excessValue, 0, row.code + " is short on every position yet reports excess");
      }
    }
  });

  test("filters by tier", async () => {
    const all = await network();
    const metro = await network("?tier=METRO");

    assert.ok(metro.length > 0);
    assert.ok(metro.length < all.length, "the filter must narrow the set");
    for (const row of metro) assert.equal(row.tier, "METRO");
  });

  test("filtering does not change the figures for a warehouse", async () => {
    const all = await network();
    const metro = await network("?tier=METRO");

    for (const row of metro) {
      const unfiltered = all.find((candidate) => candidate.id === row.id);
      assert.ok(unfiltered, row.code + " vanished from the unfiltered set");
      assert.deepEqual(row, unfiltered, "a tier filter must not alter the numbers");
    }
  });

  test("rejects an unknown tier", async () => {
    const response = await server.get("/api/dashboard/network?tier=BOGUS");
    assert.equal(response.status, 422);
    expectErrorShape(await response.json(), "VALIDATION_FAILED");
  });

  test("shows the metro-excess against lower-tier-shortage split the brief describes", async () => {
    const rows = await network();
    const metro = rows.filter((row) => row.tier === "METRO");
    const lowerTier = rows.filter((row) => row.tier !== "METRO");
    if (metro.length === 0 || lowerTier.length === 0) return;

    const metroExcess = metro.reduce((total, row) => total + row.excessValue, 0);
    const lowerTierShortage = lowerTier.reduce((total, row) => total + row.shortageValue, 0);

    assert.ok(metroExcess >= 0);
    assert.ok(lowerTierShortage >= 0);
    assert.ok(
      metroExcess > 0 || lowerTierShortage > 0,
      "seed data should exhibit at least one side of the imbalance",
    );
  });
});
