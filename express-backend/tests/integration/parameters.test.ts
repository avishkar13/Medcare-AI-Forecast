import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";

process.env.RATE_LIMIT_ENABLED = "false";
process.env.PLANNING_EXECUTOR = "disabled";

const { app } = await import("../../src/app.js");
const { prisma } = await import("../../src/config/prisma.js");
const { disconnectPrisma } = await import("../../src/config/prisma.js");
const { disconnectRedis } = await import("../../src/config/redis.js");
const { executeRun } = await import("../../src/services/planning-executor.service.js");
const { startServer } = await import("../helpers/server.js");
const { expectEnvelope, expectErrorShape } = await import("../helpers/assertions.js");

import type { TestServer } from "../helpers/server.js";

const SKU = "SKU-AMX-500";
const DC = "DC-01";

let server: TestServer;
let original: Record<string, unknown> | null = null;
const createdRuns: string[] = [];

interface Parameter {
  sku: string;
  warehouseCode: string;
  leadTimeDays: number;
  serviceLevel: number;
  reviewPeriodDays: number;
  minimumOrderQty: number;
  maximumInventory: number | null;
  holdingCostPerUnit: number;
  stockoutCostPerUnit: number;
  expiryCostPerUnit: number;
}

const put = (body: unknown) =>
  fetch(`${server.url}/api/planning/parameters`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const deleteRun = async (id: string) => {
  for (const table of ["recommendation", "dRPPlan", "supplyPlan", "inventoryPlan", "forecast", "optimizationResult", "simulationRun"] as const) {
    await (prisma as unknown as Record<string, { deleteMany: (a: unknown) => Promise<unknown> }>)[table]!.deleteMany({
      where: { planningRunId: id },
    });
  }
  await prisma.planningRun.deleteMany({ where: { id } });
};

const currentRow = async () => {
  const product = await prisma.product.findFirstOrThrow({ where: { sku: SKU }, select: { id: true } });
  const warehouse = await prisma.warehouse.findFirstOrThrow({ where: { code: DC }, select: { id: true } });
  return prisma.planningParameter.findUniqueOrThrow({
    where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
  });
};

before(async () => {
  server = await startServer(app);
  const row = await currentRow();
  original = {
    leadTimeDays: row.leadTimeDays,
    leadTimeStdDev: row.leadTimeStdDev,
    serviceLevel: row.serviceLevel,
    reviewPeriodDays: row.reviewPeriodDays,
    minimumOrderQty: row.minimumOrderQty,
    maximumInventory: row.maximumInventory,
    holdingCostPerUnit: row.holdingCostPerUnit,
    stockoutCostPerUnit: row.stockoutCostPerUnit,
    expiryCostPerUnit: row.expiryCostPerUnit,
  };
});

after(async () => {
  // Restore the seeded values; other suites assert against the safety stock they produce.
  if (original) await put({ sku: SKU, warehouse: DC, ...original });
  for (const id of createdRuns) await deleteRun(id);
  await server.close();
  await Promise.allSettled([disconnectPrisma(), disconnectRedis()]);
});

describe("GET /api/planning/parameters", () => {
  test("serves the values the engine plans with", async () => {
    const body = (await server.json(`/api/planning/parameters?sku=${SKU}&warehouse=${DC}`)) as {
      data: Parameter[];
      meta: { total: number };
    };

    assert.equal(body.data.length, 1);
    const row = body.data[0]!;
    assert.equal(row.sku, SKU);
    assert.equal(row.warehouseCode, DC);
    for (const field of ["leadTimeDays", "serviceLevel", "reviewPeriodDays", "holdingCostPerUnit"] as const) {
      assert.equal(typeof row[field], "number", `${field} must be served, not hidden`);
    }
  });

  test("paginates the whole grid", async () => {
    const body = (await server.json("/api/planning/parameters?pageSize=5")) as {
      data: Parameter[];
      meta: { total: number; pageSize: number };
    };
    assert.equal(body.data.length, 5);
    assert.ok(body.meta.total >= 160, "one row per product-warehouse pair");
  });

  test("404s on an unknown sku or warehouse", async () => {
    assert.equal((await server.get("/api/planning/parameters?sku=NOPE")).status, 404);
    assert.equal((await server.get("/api/planning/parameters?warehouse=NOPE")).status, 404);
  });
});

describe("PUT /api/planning/parameters", () => {
  test("upserts on the existing product-warehouse pair", async () => {
    const before = await currentRow();

    const response = await put({
      sku: SKU,
      warehouse: DC,
      ...original,
      reviewPeriodDays: 14,
    });
    assert.equal(response.status, 200);

    const { data } = expectEnvelope<Parameter>(await response.json());
    assert.equal(data.reviewPeriodDays, 14);

    const after = await currentRow();
    assert.equal(after.id, before.id, "PUT must update the existing row, not insert a second");
    assert.equal(after.reviewPeriodDays, 14);
  });

  test("rejects a service level outside the band", async () => {
    for (const serviceLevel of [0.4, 1, 1.5]) {
      const response = await put({ sku: SKU, warehouse: DC, ...original, serviceLevel });
      assert.equal(response.status, 422, `serviceLevel=${serviceLevel} should be rejected`);
    }
  });

  test("rejects negative costs and lead times", async () => {
    for (const patch of [
      { holdingCostPerUnit: -1 },
      { stockoutCostPerUnit: -0.5 },
      { expiryCostPerUnit: -2 },
      { leadTimeDays: -1 },
    ]) {
      const response = await put({ sku: SKU, warehouse: DC, ...original, ...patch });
      assert.equal(response.status, 422, `${JSON.stringify(patch)} should be rejected`);
    }
  });

  test("rejects a ceiling below the floor", async () => {
    const response = await put({
      sku: SKU,
      warehouse: DC,
      ...original,
      minimumOrderQty: 500,
      maximumInventory: 100,
    });

    assert.equal(response.status, 422, "an unsatisfiable range must not be storable");
    const { error } = expectErrorShape(await response.json(), "VALIDATION_FAILED");
    assert.ok(JSON.stringify(error.details).includes("maximumInventory"));
  });

  test("rejects an unknown field rather than dropping it", async () => {
    const response = await put({ sku: SKU, warehouse: DC, ...original, serviceLvl: 0.99 });
    assert.equal(response.status, 422, "a misspelled field must not leave the old value in place");
  });
});

describe("the values reach the executor", () => {
  test("raising serviceLevel raises safety stock on the next run", async () => {
    const newRun = async () => {
      const user = await prisma.user.findFirstOrThrow({ select: { id: true } });
      const run = await prisma.planningRun.create({
        data: { horizonDays: 3, createdById: user.id },
        select: { id: true },
      });
      createdRuns.push(run.id);
      await executeRun(run.id);
      return run.id;
    };

    const safetyStockFor = async (runId: string) => {
      const product = await prisma.product.findFirstOrThrow({ where: { sku: SKU }, select: { id: true } });
      const warehouse = await prisma.warehouse.findFirstOrThrow({ where: { code: DC }, select: { id: true } });
      const plan = await prisma.inventoryPlan.findFirstOrThrow({
        where: { planningRunId: runId, productId: product.id, warehouseId: warehouse.id },
        select: { safetyStock: true },
      });
      return plan.safetyStock;
    };

    await put({ sku: SKU, warehouse: DC, ...original, serviceLevel: 0.8 });
    const low = await safetyStockFor(await newRun());

    await put({ sku: SKU, warehouse: DC, ...original, serviceLevel: 0.99 });
    const high = await safetyStockFor(await newRun());

    // This is the acceptance criterion: the value is not merely stored, it changes
    // the z-score the executor multiplies demand spread by.
    assert.ok(
      high > low,
      `serviceLevel 0.99 should buffer more than 0.8, got ${high} vs ${low}`,
    );
  });
});
