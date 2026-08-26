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

describe("GET /api/expiry/exposure", () => {
  test("both cuts reconcile with the overview", async () => {
    const { data } = expectEnvelope<{
      totalExposureValue: number;
      totalUnits: number;
      byWindow: { label: string; value: number; units: number; sharePercent: number }[];
      byRisk: { level: string; value: number; units: number; sharePercent: number }[];
    }>(await server.json("/api/expiry/exposure"));

    const overview = expectEnvelope<{ totalAtRiskValue: number; unitsAtRisk: number }>(
      await server.json("/api/expiry/overview"),
    );

    assert.ok(Math.abs(data.totalExposureValue - overview.data.totalAtRiskValue) < 1);
    assert.ok(Math.abs(data.totalUnits - overview.data.unitsAtRisk) < 1);

    // every batch lands in exactly one window and exactly one risk band, so each cut
    // has to add back up to the same total
    for (const cut of [data.byWindow, data.byRisk]) {
      const value = cut.reduce((total, row) => total + row.value, 0);
      const units = cut.reduce((total, row) => total + row.units, 0);
      assert.ok(Math.abs(value - data.totalExposureValue) < 1, "value must partition the total");
      assert.ok(Math.abs(units - data.totalUnits) < 1, "units must partition the total");

      const share = cut.reduce((total, row) => total + row.sharePercent, 0);
      assert.ok(Math.abs(share - 100) < 0.5, `shares summed to ${share}, not 100`);
    }
  });
});

describe("GET /api/expiry/demand-coverage", () => {
  test("the split adds up and matches the batch-level projection", async () => {
    const { data } = expectEnvelope<{
      unitsExpiring: number;
      consumableUnits: number;
      unusedUnits: number;
      utilizationPercent: number;
      wastedSharePercent: number;
      projectedWasteValue: number;
      soonestExpiryDays: number | null;
    }>(await server.json("/api/expiry/demand-coverage"));

    assert.ok(
      Math.abs(data.consumableUnits + data.unusedUnits - data.unitsExpiring) < 1,
      "consumable and unused must account for every expiring unit",
    );
    assert.ok(Math.abs(data.utilizationPercent + data.wastedSharePercent - 100) < 0.5);
    assert.ok(data.unusedUnits >= 0 && data.consumableUnits >= 0);

    // the soonest batch on the paginated list is sorted first, so the two views of
    // "how long have we got" must agree
    const batches = expectEnvelope<{ daysRemaining: number; projectedWasteUnits: number }[]>(
      await server.json("/api/expiry/batches?pageSize=1"),
    );
    assert.equal(data.soonestExpiryDays, batches.data[0]?.daysRemaining ?? null);
  });
});

describe("GET /api/expiry/batches", () => {
  test("projects waste per batch without exceeding the batch", async () => {
    const { data } = expectEnvelope<
      {
        quantity: number;
        projectedWasteUnits: number;
        projectedWasteSharePercent: number;
        demandCoveragePercent: number;
        forecastDemand: number;
        avgDailyDemand: number;
        daysRemaining: number;
      }[]
    >(await server.json("/api/expiry/batches?pageSize=50"));

    assert.ok(data.length > 0);
    for (const batch of data) {
      assert.ok(
        batch.projectedWasteUnits <= batch.quantity + 0.01,
        "a batch cannot waste more than it holds",
      );
      assert.ok(
        Math.abs(batch.demandCoveragePercent + batch.projectedWasteSharePercent - 100) < 0.5,
        "coverage and waste share are two sides of one split",
      );
      assert.ok(
        Math.abs(batch.forecastDemand - batch.avgDailyDemand * Math.max(0, batch.daysRemaining)) < 1,
        "forecast demand is the pair's rate over the days left",
      );
    }
  });
});

describe("GET /api/expiry/*", () => {
  test("404s on an unknown warehouse", async () => {
    assert.equal((await server.get("/api/expiry/overview?warehouse=NOPE")).status, 404);
  });
});
