import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";
import { app, teardown } from "../helpers/app.js";
import { startServer, type TestServer } from "../helpers/server.js";
import { expectEnvelope, expectSortedBy } from "../helpers/assertions.js";
import { prisma } from "../../src/config/prisma.js";
import { expirySeverity } from "../../src/utils/inventory.js";

let server: TestServer;

interface Batch {
  id: string;
  daysRemaining: number;
  riskLevel: "critical" | "high" | "medium" | "low";
  inventoryValue: number;
  quantity: number;
  unitCost: number;
  expiryDate: string;
}

before(async () => {
  server = await startServer(app);
});

after(async () => {
  await server.close();
  await teardown();
});

describe("GET /api/expiry/batches", () => {
  test("paginates, soonest first", async () => {
    const body = (await server.json("/api/expiry/batches?pageSize=10")) as {
      data: Batch[];
      meta: { pageSize: number; total: number };
    };

    assert.equal(body.meta.pageSize, 10);
    assert.ok(body.meta.total > 0, "the seed holds inventory batches");
    expectSortedBy(body.data, (batch) => batch.daysRemaining, "asc");
  });

  test("risk comes from the shared expirySeverity, not a local threshold", async () => {
    const body = (await server.json("/api/expiry/batches?pageSize=50")) as { data: Batch[] };

    for (const batch of body.data) {
      assert.equal(
        batch.riskLevel,
        expirySeverity(batch.daysRemaining),
        "expiry risk must agree with /api/dashboard/expiry-risk, which uses the same function",
      );
    }
  });

  test("value is quantity times unit cost, reported once", async () => {
    const body = (await server.json("/api/expiry/batches?pageSize=20")) as { data: Batch[] };

    for (const batch of body.data) {
      assert.ok(
        Math.abs(batch.inventoryValue - batch.quantity * batch.unitCost) < 0.02,
        "the value must be derived from the quantity and cost it is shown beside",
      );
    }
  });

  test("only unexpired batches count as shelf-life risk", async () => {
    const body = (await server.json("/api/expiry/batches?pageSize=200")) as { data: Batch[] };
    for (const batch of body.data) {
      assert.ok(batch.daysRemaining >= 0, "already-expired stock is a write-off, not a risk");
    }
  });
});

describe("GET /api/expiry/overview", () => {
  test("totals agree with the batches behind them", async () => {
    const { data } = expectEnvelope<{
      batchesTracked: number;
      totalAtRiskValue: number;
      criticalBatches: number;
      preventedWasteValue: number | null;
    }>(await server.json("/api/expiry/overview"));

    const tracked = await prisma.inventoryBatch.count({ where: { expiryDate: { gte: new Date() } } });
    assert.equal(data.batchesTracked, tracked);
    assert.ok(data.totalAtRiskValue > 0);
    assert.ok(data.criticalBatches <= data.batchesTracked);
  });

  test("narrowing to one warehouse lowers the exposure", async () => {
    const all = expectEnvelope<{ totalAtRiskValue: number }>(await server.json("/api/expiry/overview"));
    const one = expectEnvelope<{ totalAtRiskValue: number }>(
      await server.json("/api/expiry/overview?warehouse=DC-01"),
    );

    assert.ok(one.data.totalAtRiskValue < all.data.totalAtRiskValue);
  });
});

describe("GET /api/expiry/dc-exposure", () => {
  test("exposure sums to the network total", async () => {
    const overview = expectEnvelope<{ totalAtRiskValue: number }>(
      await server.json("/api/expiry/overview"),
    );
    const { data } = expectEnvelope<{ totalExposureValue: number; criticalExposureValue: number }[]>(
      await server.json("/api/expiry/dc-exposure"),
    );

    const summed = data.reduce((total, dc) => total + dc.totalExposureValue, 0);
    assert.ok(
      Math.abs(summed - overview.data.totalAtRiskValue) < 1,
      `per-DC exposure ${summed} must add up to the network figure ${overview.data.totalAtRiskValue}`,
    );

    for (const dc of data) {
      assert.ok(dc.criticalExposureValue <= dc.totalExposureValue);
    }
  });
});

describe("GET /api/expiry/timeline", () => {
  test("buckets by month, soonest first", async () => {
    const { data } = expectEnvelope<{ month: string; valueExpiring: number; batchCount: number }[]>(
      await server.json("/api/expiry/timeline"),
    );

    assert.ok(data.length > 0);
    // "YYYY-MM" sorts lexically, so compare the months as numbers instead.
    expectSortedBy(data, (bucket) => Number(bucket.month.replace("-", "")), "asc");
    for (const bucket of data) {
      assert.match(bucket.month, /^\d{4}-\d{2}$/);
      assert.ok(bucket.batchCount > 0, "a month with no batches should not be a bucket");
    }
  });
});

describe("GET /api/expiry/*", () => {
  test("404s on an unknown warehouse", async () => {
    assert.equal((await server.get("/api/expiry/overview?warehouse=NOPE")).status, 404);
  });
});
