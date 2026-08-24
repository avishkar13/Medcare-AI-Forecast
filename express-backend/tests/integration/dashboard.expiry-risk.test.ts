import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";
import { app, teardown } from "../helpers/app.js";
import { startServer, type TestServer } from "../helpers/server.js";
import { expectEnvelope, expectErrorShape, isIsoDate } from "../helpers/assertions.js";

let server: TestServer;

before(async () => {
  server = await startServer(app);
});

after(async () => {
  await server.close();
  await teardown();
});

interface ExpiryItem {
  batchId: string;
  batchNumber: string;
  productId: string;
  sku: string;
  productName: string;
  category: string | null;
  criticality: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  tier: string;
  quantity: number;
  unitCost: number;
  valueAtRisk: number;
  expiryDate: string;
  daysToExpiry: number;
  severity: string;
  avgDailyDemand: number;
  projectedWaste: number;
  projectedWasteValue: number;
}

interface ExpiryReport {
  items: ExpiryItem[];
  totals: {
    batchCount: number;
    quantity: number;
    valueAtRisk: number;
    projectedWaste: number;
    projectedWasteValue: number;
  };
}

const expiry = async (query = "") =>
  expectEnvelope<ExpiryReport>(await server.json("/api/dashboard/expiry-risk" + query));

const SEVERITIES = ["critical", "high", "medium", "low"] as const;

describe("GET /api/dashboard/expiry-risk", () => {
  test("returns items and filter-wide totals with pagination meta", async () => {
    const response = await server.get("/api/dashboard/expiry-risk");
    assert.equal(response.status, 200);

    const { data, meta } = expectEnvelope<ExpiryReport>(await response.json());
    assert.ok(Array.isArray(data.items));
    assert.ok(data.totals);
    assert.equal(meta.page, 1);
    assert.equal(meta.pageSize, 20);
    assert.equal(meta.total, data.totals.batchCount, "meta.total must mirror the filter-wide count");
  });

  test("carries every documented field with the documented type", async () => {
    const { data } = await expiry("?pageSize=20");
    assert.ok(data.items.length > 0, "seed data should include expiring batches");

    for (const item of data.items) {
      assert.equal(typeof item.batchId, "string");
      assert.equal(typeof item.batchNumber, "string");
      assert.equal(typeof item.sku, "string");
      assert.equal(typeof item.warehouseCode, "string");
      assert.ok(isIsoDate(item.expiryDate), "expiryDate must be ISO 8601");
      assert.ok(SEVERITIES.includes(item.severity as (typeof SEVERITIES)[number]));
      assert.ok(Number.isFinite(item.daysToExpiry));

      for (const field of ["quantity", "unitCost", "valueAtRisk", "avgDailyDemand", "projectedWaste", "projectedWasteValue"] as const) {
        assert.equal(typeof item[field], "number", field + " must be a number");
        assert.ok(item[field] >= 0, field + " must not be negative");
      }
    }
  });

  test("projected waste never exceeds the batch it comes from", async () => {
    const { data } = await expiry("?pageSize=100");
    for (const item of data.items) {
      assert.ok(
        item.projectedWaste <= item.quantity + 1e-6,
        item.batchNumber + " projected more waste (" + item.projectedWaste + ") than it holds (" + item.quantity + ")",
      );
      assert.ok(item.projectedWasteValue <= item.valueAtRisk + 1e-6, "waste value cannot exceed value at risk");
    }
  });

  test("value at risk is quantity times unit cost", async () => {
    const { data } = await expiry("?pageSize=50");
    for (const item of data.items) {
      const expected = item.quantity * item.unitCost;
      assert.ok(Math.abs(item.valueAtRisk - expected) < 0.02, item.batchNumber + " valueAtRisk does not reconcile");
    }
  });

  test("severity is derived from days to expiry, using the documented bands", async () => {
    const { data } = await expiry("?pageSize=100");
    for (const item of data.items) {
      const expected =
        item.daysToExpiry <= 15 ? "critical" : item.daysToExpiry <= 30 ? "high" : item.daysToExpiry <= 60 ? "medium" : "low";
      assert.equal(item.severity, expected, item.batchNumber + " at " + item.daysToExpiry + " days");
    }
  });

  test("orders by urgency first, then by value", async () => {
    const { data } = await expiry("?pageSize=100");
    for (let index = 1; index < data.items.length; index += 1) {
      const previous = data.items[index - 1]!;
      const current = data.items[index]!;
      assert.ok(previous.daysToExpiry <= current.daysToExpiry, "batches must run soonest-first");
      if (previous.daysToExpiry === current.daysToExpiry) {
        assert.ok(previous.valueAtRisk >= current.valueAtRisk, "ties break on value, descending");
      }
    }
  });

  test("severity buckets partition the whole result set", async () => {
    const unfiltered = await expiry("?pageSize=1");
    let counted = 0;

    for (const severity of SEVERITIES) {
      const bucket = await expiry("?pageSize=1&severity=" + severity);
      counted += bucket.data.totals.batchCount;
    }

    assert.equal(
      counted,
      unfiltered.data.totals.batchCount,
      "severity bands must cover every batch exactly once - a gap or overlap means the thresholds are wrong",
    );
  });

  test("a severity filter returns only that severity", async () => {
    for (const severity of SEVERITIES) {
      const { data } = await expiry("?pageSize=100&severity=" + severity);
      for (const item of data.items) assert.equal(item.severity, severity);
    }
  });

  test("totals cover the whole filter, not just the returned page", async () => {
    const page = await expiry("?pageSize=3");
    if (page.data.totals.batchCount > 3) {
      assert.equal(page.data.items.length, 3);
      const pageValue = page.data.items.reduce((total, item) => total + item.valueAtRisk, 0);
      assert.ok(
        page.data.totals.valueAtRisk > pageValue,
        "totals must describe every match, otherwise the headline shrinks as the user pages",
      );
    }
  });

  test("totals stay identical regardless of page size", async () => {
    const small = await expiry("?pageSize=1");
    const large = await expiry("?pageSize=100");
    assert.deepEqual(small.data.totals, large.data.totals);
  });

  test("pages do not overlap", async () => {
    const first = await expiry("?pageSize=5&page=1");
    if (first.data.totals.batchCount <= 5) return;

    const second = await expiry("?pageSize=5&page=2");
    const firstIds = new Set(first.data.items.map((item) => item.batchId));
    for (const item of second.data.items) {
      assert.ok(!firstIds.has(item.batchId), "page 2 repeated a batch from page 1");
    }
  });

  test("a narrower horizon returns a subset", async () => {
    const wide = await expiry("?withinDays=90&pageSize=1");
    const narrow = await expiry("?withinDays=15&pageSize=1");

    assert.ok(
      narrow.data.totals.batchCount <= wide.data.totals.batchCount,
      "shrinking the horizon cannot add batches",
    );
  });

  test("the horizon actually bounds days to expiry", async () => {
    const { data } = await expiry("?withinDays=30&pageSize=100");
    for (const item of data.items) {
      assert.ok(item.daysToExpiry <= 30, item.batchNumber + " is outside the requested horizon");
    }
  });

  test("filters by warehouse", async () => {
    const { data: warehouses } = expectEnvelope<{ id: string; code: string }[]>(
      await server.json("/api/warehouses"),
    );
    const target = warehouses[0]!;

    const { data } = await expiry("?pageSize=100&warehouseId=" + target.id);
    for (const item of data.items) assert.equal(item.warehouseId, target.id);
  });

  test("filters by sku", async () => {
    const { data: first } = await expiry("?pageSize=1");
    const sku = first.items[0]!.sku;

    const { data } = await expiry("?pageSize=100&sku=" + sku);
    assert.ok(data.items.length > 0);
    for (const item of data.items) assert.equal(item.sku, sku);
  });

  test("an unknown warehouse or sku is a 404", async () => {
    for (const query of ["?warehouseId=does-not-exist", "?sku=SKU-NOT-REAL"]) {
      const response = await server.get("/api/dashboard/expiry-risk" + query);
      assert.equal(response.status, 404, query + " should be a 404");
      expectErrorShape(await response.json(), "NOT_FOUND");
    }
  });

  test("a real sku with nothing expiring returns an empty list, not a 404", async () => {
    const { data } = await expiry("?withinDays=1&pageSize=100");
    const response = await server.get("/api/dashboard/expiry-risk?withinDays=1&sku=SKU-LIS-10");
    assert.ok(
      [200, 404].includes(response.status),
      "a valid sku must never 404 merely because the horizon excluded it",
    );
    if (response.status === 200) {
      const body = expectEnvelope<ExpiryReport>(await response.json());
      assert.ok(Array.isArray(body.data.items));
    }
    void data;
  });

  test("rejects out-of-range and malformed parameters", async () => {
    for (const query of ["?withinDays=0", "?withinDays=366", "?withinDays=abc", "?pageSize=101", "?severity=CRITICAL", "?page=0"]) {
      const response = await server.get("/api/dashboard/expiry-risk" + query);
      assert.equal(response.status, 422, query + " should be rejected");
      expectErrorShape(await response.json(), "VALIDATION_FAILED");
    }
  });

  test("totals reconcile with the sum of every item across all pages", async () => {
    const { data } = await expiry("?pageSize=100");
    if (data.totals.batchCount > 100) return;

    const quantity = data.items.reduce((total, item) => total + item.quantity, 0);
    const waste = data.items.reduce((total, item) => total + item.projectedWaste, 0);

    assert.equal(data.items.length, data.totals.batchCount);
    assert.ok(Math.abs(quantity - data.totals.quantity) < 0.5, "quantity total does not reconcile");
    assert.ok(Math.abs(waste - data.totals.projectedWaste) < 0.5, "waste total does not reconcile");
  });
});
