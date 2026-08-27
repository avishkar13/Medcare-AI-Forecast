import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";
import { app, teardown } from "../helpers/app.js";
import { startServer, type TestServer } from "../helpers/server.js";
import { prisma } from "../../src/config/prisma.js";
import { redis } from "../../src/config/redis.js";

/**
 * Per item-location alert thresholds.
 *
 * The whole point of the change: two positions in the same network, judged by different
 * numbers. These tests drive the real detector rather than the resolver in isolation, so
 * they prove the override actually reaches the decision.
 *
 * Nothing here pins a seeded figure. The pair under test is chosen from whatever the
 * detector currently raises, and its own reported probability is used to build a
 * threshold that must exclude it.
 */

let server: TestServer;

interface AlertRow {
  id: string;
  type: string;
  productId: string | null;
  warehouseId: string | null;
  status: string;
  metrics: { label: string; value: string }[];
}

/** Restored in `after`, so the suite leaves the shared parameters as it found them. */
let touched: { productId: string; warehouseId: string } | null = null;

before(async () => {
  if (redis) await redis.flushdb();
  server = await startServer(app);
});

after(async () => {
  if (touched) {
    await prisma.planningParameter.updateMany({
      where: { productId: touched.productId, warehouseId: touched.warehouseId },
      data: { alertStockoutProbability: null, alertExpiryWindowDays: null },
    });
  }
  await server.close();
  await teardown();
});

const refresh = async () => {
  const response = await server.post("/api/alerts/refresh");
  assert.equal(response.status, 200, "detection must run");
  return (await response.json()) as { data: { detected: number; created: number } };
};

const openStockoutAlerts = async (): Promise<AlertRow[]> => {
  const { data } = (await server.json(
    "/api/alerts?type=stockout_risk&status=open&pageSize=200",
  )) as { data: AlertRow[] };
  return data;
};

const setOverride = (
  productId: string,
  warehouseId: string,
  data: { alertStockoutProbability?: number | null; alertExpiryWindowDays?: number | null },
) => prisma.planningParameter.updateMany({ where: { productId, warehouseId }, data });

const probabilityOf = (alert: AlertRow): number =>
  Number((alert.metrics.find((m) => m.label === "Stockout probability")?.value ?? "0").replace("%", ""));

describe("per item-location alert thresholds", () => {
  test("an override raises the bar for one position and leaves its neighbours alone", async () => {
    await refresh();
    const before = await openStockoutAlerts();
    assert.ok(before.length >= 2, "need at least two stockout alerts to tell them apart");

    // A pair whose own probability is below 100, so a threshold above it must exclude it.
    const target = before.find(
      (alert) => alert.productId && alert.warehouseId && probabilityOf(alert) < 100,
    );
    assert.ok(target, "no stockout alert reported a probability under 100%");

    touched = { productId: target.productId!, warehouseId: target.warehouseId! };
    const others = before.filter((alert) => alert.id !== target.id).map((alert) => alert.id);

    // Just above what this position actually reports: it can no longer clear its own bar,
    // while every other position is still judged by the unchanged global value.
    await setOverride(touched.productId, touched.warehouseId, {
      alertStockoutProbability: Math.min(100, probabilityOf(target) + 1),
    });

    await refresh();
    const after = await openStockoutAlerts();

    assert.ok(
      !after.some((alert) => alert.id === target.id),
      "the overridden position should no longer be alerting",
    );

    const survivors = after.map((alert) => alert.id);
    for (const id of others) {
      assert.ok(
        survivors.includes(id),
        "raising one position's threshold must not silence another",
      );
    }
  });

  test("clearing the override returns the position to the global verdict", async () => {
    assert.ok(touched, "previous test must have set an override");

    await setOverride(touched.productId, touched.warehouseId, {
      alertStockoutProbability: null,
    });
    await refresh();

    const alerts = await openStockoutAlerts();
    assert.ok(
      alerts.some(
        (alert) =>
          alert.productId === touched!.productId && alert.warehouseId === touched!.warehouseId,
      ),
      "inheritance must be reachable again - an override cannot be a one-way door",
    );
  });

  test("the alert says which threshold judged it, and whether it was inherited", async () => {
    await refresh();
    const alerts = await openStockoutAlerts();
    assert.ok(alerts.length > 0);

    for (const alert of alerts) {
      const threshold = alert.metrics.find((metric) => metric.label === "Threshold");
      assert.ok(threshold, "every stockout alert must report the threshold it was judged against");
      assert.ok(
        threshold.value.includes("(global)") || threshold.value.includes("(set for this SKU)"),
        `threshold must say where it came from, got "${threshold.value}"`,
      );
    }
  });

  test("a global change still moves every position that has not overridden", async () => {
    // The global path is not replaced by overrides - it remains the default for the
    // ~160 pairs nobody has tuned.
    const original = await prisma.alertSettings.findFirstOrThrow({
      select: { id: true, thresholdStockoutProb: true },
    });

    try {
      await prisma.alertSettings.update({
        where: { id: original.id },
        data: { thresholdStockoutProb: 100 },
      });
      await refresh();

      const alerts = await openStockoutAlerts();
      const inherited = alerts.filter((alert) =>
        alert.metrics.some((m) => m.label === "Threshold" && m.value.includes("(global)")),
      );
      assert.equal(
        inherited.length,
        0,
        "an impossible global threshold must silence every inheriting position",
      );
    } finally {
      await prisma.alertSettings.update({
        where: { id: original.id },
        data: { thresholdStockoutProb: original.thresholdStockoutProb },
      });
      await refresh();
    }
  });
});
