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

interface PositionItem {
  productId: string;
  sku: string;
  productName: string;
  category: string | null;
  criticality: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  tier: string;
  onHand: number;
  reserved: number;
  inTransit: number;
  available: number;
  safetyStock: number;
  reorderPoint: number;
  maximumInventory: number | null;
  avgDailyDemand: number;
  leadTimeDays: number;
  daysOfSupply: number;
  unitCost: number;
  inventoryValue: number;
  expiringUnits: number;
  expiringValue: number;
  daysToNearestExpiry: number | null;
  status: string;
  risk: string;
}

interface Totals {
  positionCount: number;
  skuCount: number;
  warehouseCount: number;
  onHandUnits: number;
  inventoryValue: number;
  belowSafetyStockCount: number;
  belowReorderPointCount: number;
  aboveMaximumCount: number;
  expiringValue: number;
}

interface ListReport {
  items: PositionItem[];
  totals: Totals;
}

interface Batch {
  batchId: string;
  batchNumber: string;
  warehouseId: string;
  warehouseCode: string;
  quantity: number;
  unitCost: number;
  valueAtRisk: number;
  manufacturingDate: string | null;
  expiryDate: string;
  daysToExpiry: number;
  severity: string;
}

interface Detail {
  product: { id: string; sku: string; name: string; unitCost: number };
  totals: Totals;
  positions: PositionItem[];
  batches: Batch[];
}

const STATUSES = ["criticalStock", "belowReorderPoint", "expiringSoon", "excessStock", "healthy"];
const RISKS = ["critical", "high", "medium", "low"];

const list = async (query = ""): Promise<ListReport> =>
  expectEnvelope<ListReport>(await server.json(`/api/inventory${query}`)).data;

describe("GET /api/inventory", () => {
  test("returns a paginated envelope carrying items and totals", async () => {
    const response = await server.get("/api/inventory");
    assert.equal(response.status, 200);

    const { data, meta } = expectEnvelope<ListReport>(await response.json());
    assert.ok(Array.isArray(data.items));
    assert.ok(data.items.length > 0, "seed data is missing - run pnpm prisma:seed");
    assert.equal(meta.page, 1);
    assert.equal(meta.pageSize, 50);
    assert.equal(typeof meta.total, "number");
  });

  test("every position carries the documented fields with the documented types", async () => {
    const { items } = await list("?pageSize=10");

    for (const item of items) {
      for (const field of [item.productId, item.sku, item.productName, item.warehouseCode]) {
        assert.equal(typeof field, "string");
      }
      assert.ok(item.category === null || typeof item.category === "string");
      assert.ok(item.maximumInventory === null || typeof item.maximumInventory === "number");
      assert.ok(item.daysToNearestExpiry === null || typeof item.daysToNearestExpiry === "number");
      assert.ok(STATUSES.includes(item.status), `unknown status: ${item.status}`);
      assert.ok(RISKS.includes(item.risk), `unknown risk: ${item.risk}`);
      for (const figure of [item.onHand, item.safetyStock, item.reorderPoint, item.inventoryValue]) {
        assert.equal(typeof figure, "number");
        assert.ok(Number.isFinite(figure));
      }
    }
  });

  test("derived figures agree with the raw ones on the same row", async () => {
    for (const item of (await list("?pageSize=25")).items) {
      assert.equal(item.available, Math.round((item.onHand - item.reserved) * 100) / 100);
      assert.ok(
        Math.abs(item.inventoryValue - item.onHand * item.unitCost) < 0.5,
        `${item.sku}: inventoryValue does not match onHand x unitCost`,
      );
    }
  });

  test("totals describe the whole filtered set, not the page", async () => {
    const page = await list("?pageSize=1");
    const everything = await list("?pageSize=200");

    assert.equal(page.items.length, 1);
    assert.equal(page.totals.positionCount, everything.items.length);
    assert.equal(page.totals.inventoryValue, everything.totals.inventoryValue);
  });

  test("totals agree with the dashboard, which computes them independently", async () => {
    const { totals } = await list("?pageSize=1");
    const summary = expectEnvelope<{
      kpis: { totalInventoryValue: number; stockoutRiskItems: number };
      networkHealth: { atRiskSkuCount: number };
    }>(await server.json("/api/dashboard/summary")).data;

    assert.equal(totals.inventoryValue, summary.kpis.totalInventoryValue);
    assert.equal(totals.belowReorderPointCount, summary.kpis.stockoutRiskItems);
    assert.equal(totals.belowSafetyStockCount, summary.networkHealth.atRiskSkuCount);
  });

  test("the status filter returns only that status, and the states partition the set", async () => {
    const all = await list("?pageSize=200");
    let counted = 0;

    for (const status of STATUSES) {
      const scoped = await list(`?status=${status}&pageSize=200`);
      for (const item of scoped.items) assert.equal(item.status, status);
      counted += scoped.totals.positionCount;
    }

    assert.equal(counted, all.totals.positionCount, "every position must land in exactly one status");
  });

  test("the risk filter returns only that risk level", async () => {
    for (const risk of RISKS) {
      const scoped = await list(`?risk=${risk}&pageSize=200`);
      for (const item of scoped.items) assert.equal(item.risk, risk);
    }
  });

  test("a position below safety stock is never anything but critical risk", async () => {
    for (const item of (await list("?pageSize=200")).items) {
      if (item.onHand < item.safetyStock) {
        assert.equal(item.risk, "critical", `${item.sku} at ${item.warehouseCode} is below safety stock`);
      }
    }
  });

  test("the warehouse filter accepts a code, a name or a cuid", async () => {
    const [sample] = (await list("?pageSize=1")).items;
    assert.ok(sample);

    const byCode = await list(`?warehouse=${sample.warehouseCode}&pageSize=200`);
    const byId = await list(`?warehouse=${sample.warehouseId}&pageSize=200`);
    const byName = await list(`?warehouse=${encodeURIComponent(sample.warehouseName)}&pageSize=200`);

    assert.equal(byCode.totals.positionCount, byId.totals.positionCount);
    assert.equal(byCode.totals.positionCount, byName.totals.positionCount);
    assert.equal(byCode.totals.warehouseCount, 1);
    for (const item of byCode.items) assert.equal(item.warehouseCode, sample.warehouseCode);
  });

  test("search matches the sku or the product name, case-insensitively", async () => {
    const [sample] = (await list("?pageSize=1")).items;
    assert.ok(sample);

    const { items } = await list(`?search=${sample.sku.toLowerCase()}&pageSize=200`);
    assert.ok(items.length > 0, "a sku that exists should match itself");
    for (const item of items) {
      const haystack = `${item.sku} ${item.productName}`.toLowerCase();
      assert.ok(haystack.includes(sample.sku.toLowerCase()));
    }
  });

  test("sorting by sku is stable and ascending", async () => {
    const { items } = await list("?sort=sku&pageSize=200");
    for (let index = 1; index < items.length; index += 1) {
      const previous = items[index - 1]!;
      const current = items[index]!;
      const order = previous.sku.localeCompare(current.sku);
      assert.ok(
        order < 0 || (order === 0 && previous.warehouseCode <= current.warehouseCode),
        `not ordered at ${index}: ${previous.sku}/${previous.warehouseCode}`,
      );
    }
  });

  test("sorting by risk puts the worst first", async () => {
    const rank = { critical: 0, high: 1, medium: 2, low: 3 } as Record<string, number>;
    const { items } = await list("?sort=risk&pageSize=200");
    expectSortedBy(items, (item) => rank[item.risk]!);
  });

  test("sorting by inventoryValue puts the most expensive first", async () => {
    const { items } = await list("?sort=inventoryValue&pageSize=200");
    expectSortedBy(items, (item) => item.inventoryValue, "desc");
  });

  test("positions with no recorded demand sort last by days of supply, not first", async () => {
    const { items } = await list("?sort=daysOfSupply&pageSize=200");
    const withDemand = items.filter((item) => item.avgDailyDemand > 0);
    const firstIdle = items.findIndex((item) => item.avgDailyDemand === 0);

    if (firstIdle !== -1) {
      assert.equal(firstIdle, withDemand.length, "a position with unknown supply is not the most urgent");
    }
    expectSortedBy(withDemand, (item) => item.daysOfSupply);
  });

  test("paging walks the set without repeating or dropping a row", async () => {
    const everything = await list("?pageSize=200&sort=sku");
    const firstPage = await list("?pageSize=5&page=1&sort=sku");
    const secondPage = await list("?pageSize=5&page=2&sort=sku");

    assert.deepEqual(
      [...firstPage.items, ...secondPage.items].map((item) => `${item.sku}:${item.warehouseCode}`),
      everything.items.slice(0, 10).map((item) => `${item.sku}:${item.warehouseCode}`),
    );
  });

  test("a page past the end is empty but still reports the true total", async () => {
    const { data, meta } = expectEnvelope<ListReport>(
      await server.json("/api/inventory?page=999&pageSize=50"),
    );
    assert.equal(data.items.length, 0);
    assert.ok((meta.total ?? 0) > 0);
  });

  test("rejects parameters the schema does not accept", async () => {
    for (const query of ["?status=at_risk", "?risk=nope", "?sort=price", "?pageSize=201", "?page=0"]) {
      const response = await server.get(`/api/inventory${query}`);
      assert.equal(response.status, 422, `${query} should not be accepted`);
      expectErrorShape(await response.json(), "VALIDATION_FAILED");
    }
  });

  test("an unknown warehouse is a 404, not an empty list", async () => {
    const response = await server.get("/api/inventory?warehouse=DC-99");
    assert.equal(response.status, 404);
    expectErrorShape(await response.json(), "NOT_FOUND");
  });
});

describe("GET /api/inventory/:id", () => {
  test("resolves by sku and by cuid to the same product", async () => {
    const [sample] = (await list("?pageSize=1")).items;
    assert.ok(sample);

    const bySku = expectEnvelope<Detail>(await server.json(`/api/inventory/${sample.sku}`)).data;
    const byId = expectEnvelope<Detail>(await server.json(`/api/inventory/${sample.productId}`)).data;

    assert.equal(bySku.product.id, byId.product.id);
    assert.equal(bySku.product.sku, sample.sku);
  });

  test("every position belongs to the requested product and is ordered by warehouse", async () => {
    const [sample] = (await list("?pageSize=1")).items;
    assert.ok(sample);

    const { positions } = expectEnvelope<Detail>(
      await server.json(`/api/inventory/${sample.sku}`),
    ).data;

    assert.ok(positions.length > 0);
    for (const position of positions) assert.equal(position.sku, sample.sku);
    for (let index = 1; index < positions.length; index += 1) {
      assert.ok(positions[index - 1]!.warehouseCode <= positions[index]!.warehouseCode);
    }
  });

  test("totals summarise the positions listed alongside them", async () => {
    const [sample] = (await list("?pageSize=1")).items;
    assert.ok(sample);

    const { totals, positions } = expectEnvelope<Detail>(
      await server.json(`/api/inventory/${sample.sku}`),
    ).data;

    const onHand = positions.reduce((sum, position) => sum + position.onHand, 0);
    assert.equal(totals.positionCount, positions.length);
    assert.equal(totals.skuCount, 1);
    assert.ok(Math.abs(totals.onHandUnits - onHand) < 0.5);
  });

  test("batches are ordered soonest-expiring first and priced off the product", async () => {
    const [sample] = (await list("?pageSize=1")).items;
    assert.ok(sample);

    const { product, batches } = expectEnvelope<Detail>(
      await server.json(`/api/inventory/${sample.sku}`),
    ).data;

    expectSortedBy(batches, (batch) => Date.parse(batch.expiryDate));

    for (const batch of batches) {
      assert.ok(batch.quantity > 0, "a depleted batch is not stock");
      assert.equal(batch.unitCost, product.unitCost);
      assert.ok(Math.abs(batch.valueAtRisk - batch.quantity * batch.unitCost) < 0.5);
      assert.ok(RISKS.includes(batch.severity));
      assert.ok(batch.manufacturingDate === null || !Number.isNaN(Date.parse(batch.manufacturingDate)));
    }
  });

  test("severity follows the same bands the expiry-risk route uses", async () => {
    const [sample] = (await list("?pageSize=1")).items;
    assert.ok(sample);

    const { batches } = expectEnvelope<Detail>(await server.json(`/api/inventory/${sample.sku}`)).data;

    for (const batch of batches) {
      const expected =
        batch.daysToExpiry <= 15
          ? "critical"
          : batch.daysToExpiry <= 30
            ? "high"
            : batch.daysToExpiry <= 60
              ? "medium"
              : "low";
      assert.equal(batch.severity, expected, `${batch.batchNumber} at ${batch.daysToExpiry} days`);
    }
  });

  test("an unknown product is a 404", async () => {
    const response = await server.get("/api/inventory/NOT-A-SKU");
    assert.equal(response.status, 404);
    expectErrorShape(await response.json(), "NOT_FOUND");
  });
});
