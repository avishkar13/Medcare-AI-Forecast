import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { app, teardown } from "../helpers/app.js";
import { startServer, type TestServer } from "../helpers/server.js";
import { expectEnvelope, expectErrorShape } from "../helpers/assertions.js";
import { prisma } from "../../src/config/prisma.js";

let server: TestServer;
const created: string[] = [];

const makeAlert = async (overrides: Partial<{ severity: string; status: string; type: string; location: string; detectedAt: Date }> = {}) => {
  const alert = await prisma.alert.create({
    data: {
      severity: overrides.severity ?? "critical",
      type: overrides.type ?? "stockout",
      title: `test-${randomUUID().slice(0, 8)}`,
      location: overrides.location ?? "DC-01",
      detectedAt: overrides.detectedAt ?? new Date(),
      businessImpact: "test impact",
      status: overrides.status ?? "new",
      recommendedAction: "test action",
      explanation: "test explanation",
    },
    select: { id: true },
  });
  created.push(alert.id);
  return alert.id;
};

before(async () => {
  server = await startServer(app);
});

after(async () => {
  await prisma.alert.deleteMany({ where: { id: { in: created } } });
  await server.close();
  await teardown();
});

describe("GET /api/alerts/overview", () => {
  test("counts each alert once", async () => {
    // One critical, unresolved alert lands in criticalCount AND unresolvedCount. The
    // route this replaces summed those buckets to get a total, so it double-counted
    // and reported a resolved percentage that was always too low.
    await makeAlert({ severity: "critical", status: "new" });
    await makeAlert({ severity: "high", status: "resolved" });

    const { data } = expectEnvelope<{
      totalCount: number;
      criticalCount: number;
      highCount: number;
      unresolvedCount: number;
      resolvedCount: number;
      resolvedPercentage: number | null;
    }>(await server.json("/api/alerts/overview"));

    const actual = await prisma.alert.count();
    assert.equal(data.totalCount, actual, "the total must be a count, not a sum of overlapping buckets");
    assert.ok(
      data.criticalCount + data.highCount + data.unresolvedCount + data.resolvedCount >= data.totalCount,
      "the buckets genuinely overlap, which is why summing them was wrong",
    );
    assert.ok(data.resolvedPercentage !== null && data.resolvedPercentage <= 100);
  });
});

/**
 * The KPI strip and the list must answer the same question.
 *
 * `/overview`, `/trends` and `/distribution` read no query at all, so they answered
 * network-wide while `/alerts` honoured `?warehouseId=`. On a DC-scoped page that put
 * "9 critical, 38 unresolved" above a list of 8 alerts of which 5 were critical - the
 * header contradicting the table directly beneath it.
 */
describe("the summary reads follow the same scope as the list", () => {
  test("overview narrows to a warehouse and agrees with the list", async () => {
    const warehouse = await prisma.warehouse.findFirst({ select: { id: true } });
    if (!warehouse) return;

    const [overview, list] = await Promise.all([
      server.json<{ data: { totalCount: number } }>(
        `/api/alerts/overview?warehouseId=${warehouse.id}`,
      ),
      server.json<{ meta: { total: number } }>(
        `/api/alerts?warehouseId=${warehouse.id}&pageSize=200`,
      ),
    ]);

    assert.equal(
      overview.data.totalCount,
      list.meta.total,
      "the overview total must equal the number of alerts the list reports for the same DC",
    );
  });

  test("a scoped overview is not simply the network answer", async () => {
    const warehouse = await prisma.warehouse.findFirst({ select: { id: true } });
    if (!warehouse) return;

    const [scoped, network] = await Promise.all([
      server.json<{ data: { totalCount: number } }>(
        `/api/alerts/overview?warehouseId=${warehouse.id}`,
      ),
      server.json<{ data: { totalCount: number } }>("/api/alerts/overview"),
    ]);

    // Only meaningful when more than one DC actually holds alerts; otherwise the two
    // legitimately match and there is nothing to prove.
    const spread = await prisma.alert.groupBy({ by: ["warehouseId"], _count: true });
    if (spread.filter((row) => row.warehouseId !== null).length < 2) return;

    assert.ok(
      scoped.data.totalCount <= network.data.totalCount,
      "a scoped overview can never exceed the network one",
    );
    assert.notEqual(
      scoped.data.totalCount,
      network.data.totalCount,
      "the warehouse filter was ignored - the scoped overview equals the network total",
    );
  });

  test("distribution and trends accept the same filter without erroring", async () => {
    const warehouse = await prisma.warehouse.findFirst({ select: { id: true } });
    if (!warehouse) return;

    for (const path of [
      `/api/alerts/distribution?warehouseId=${warehouse.id}`,
      `/api/alerts/trends?days=14&warehouseId=${warehouse.id}`,
    ]) {
      const response = await server.get(path);
      assert.equal(response.status, 200, `${path} should accept a warehouse filter`);
    }
  });
});

describe("GET /api/alerts", () => {
  test("paginates and shapes rows rather than returning raw records", async () => {
    await makeAlert();

    const body = (await server.json("/api/alerts?pageSize=1")) as {
      data: { id: string; ageDays: number; detectedAt: string }[];
      meta: { pageSize: number; total: number };
    };

    assert.equal(body.data.length, 1);
    assert.equal(body.meta.pageSize, 1);
    assert.ok(body.meta.total >= 1);
    assert.equal(typeof body.data[0]!.ageDays, "number", "rows are shaped, not passed through");
    assert.ok(body.data[0]!.detectedAt.endsWith("Z"), "dates are serialised, not Date objects");
  });

  test("status=open covers every unresolved state", async () => {
    await makeAlert({ status: "acknowledged" });

    const body = (await server.json("/api/alerts?status=open&pageSize=200")) as {
      data: { status: string }[];
    };

    assert.ok(body.data.length > 0);
    for (const alert of body.data) {
      assert.notEqual(alert.status, "resolved");
    }
  });
});

describe("PATCH /api/alerts/:id", () => {
  test("acknowledging records the change on the timeline", async () => {
    const id = await makeAlert({ status: "new" });

    const response = await fetch(`${server.url}/api/alerts/${id}/acknowledge`, { method: "PATCH" });
    assert.equal(response.status, 200);

    const { data } = expectEnvelope<{ status: string; timeline: { description: string }[] }>(
      await response.json(),
    );
    assert.equal(data.status, "acknowledged");
    assert.ok(
      data.timeline.some((event) => event.description.includes("acknowledged")),
      "a status change with no audit trail makes the timeline a lie by omission",
    );
  });

  test("a resolved alert cannot be walked backwards", async () => {
    const id = await makeAlert({ status: "resolved" });

    const response = await fetch(`${server.url}/api/alerts/${id}/acknowledge`, { method: "PATCH" });
    assert.equal(response.status, 409);
    expectErrorShape(await response.json(), "CONFLICT");
  });

  test("404s on an unknown alert instead of failing as a server error", async () => {
    const response = await fetch(`${server.url}/api/alerts/does-not-exist/resolve`, {
      method: "PATCH",
    });
    assert.equal(response.status, 404, "a missing row is the caller's mistake, not a 500");
    expectErrorShape(await response.json(), "NOT_FOUND");
  });
});

describe("GET /api/alerts/trends", () => {
  test("includes quiet days rather than skipping them", async () => {
    const body = (await server.json("/api/alerts/trends?days=7")) as {
      data: { points: { date: string; total: number }[] };
    };

    assert.equal(body.data.points.length, 7, "a chart that omits empty days draws through an outage");
    for (const day of body.data.points) assert.equal(typeof day.total, "number");
  });

  test("carries the period-over-period comparison the chart reports", async () => {
    const body = (await server.json("/api/alerts/trends?days=14")) as {
      data: {
        points: { critical: number }[];
        comparison: {
          halfWindowDays: number;
          currentCritical: number;
          previousCritical: number;
          criticalChangePercent: number | null;
        };
      };
    };

    const { points, comparison } = body.data;
    assert.equal(points.length, 14);
    assert.equal(comparison.halfWindowDays, 7);

    // the two halves must account for every critical alert in the window, or the
    // footer and the bars are describing different data
    const total = points.reduce((sum, point) => sum + point.critical, 0);
    assert.equal(comparison.currentCritical + comparison.previousCritical, total);

    // a rise from nothing has no percentage
    if (comparison.previousCritical === 0) {
      assert.equal(comparison.criticalChangePercent, null);
    } else {
      assert.equal(typeof comparison.criticalChangePercent, "number");
    }
  });
});
