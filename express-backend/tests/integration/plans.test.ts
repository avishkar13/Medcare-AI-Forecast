import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";

process.env.RATE_LIMIT_ENABLED = "false";
process.env.PLANNING_EXECUTOR = "disabled";

const { app } = await import("../../src/app.js");
const { prisma } = await import("../../src/config/prisma.js");
const { disconnectPrisma } = await import("../../src/config/prisma.js");
const { disconnectRedis } = await import("../../src/config/redis.js");
const { executeRun } = await import("../../src/services/planning-executor.service.js");
const { pruneOldRunArtifacts } = await import("../../src/services/retention.service.js");
const { startServer } = await import("../helpers/server.js");
const { expectEnvelope, expectErrorShape, expectSortedBy } = await import("../helpers/assertions.js");

import type { TestServer } from "../helpers/server.js";

let server: TestServer;
let runId: string;
const created: string[] = [];

interface SupplyPlan {
  id: string;
  planningRunId: string;
  sku: string;
  warehouseCode: string;
  date: string;
  quantity: number;
  source: string;
  status: string;
}

interface DrpPlan {
  id: string;
  sku: string;
  fromWarehouseCode: string;
  toWarehouseCode: string;
  date: string;
  quantity: number;
}

const newRun = async (horizonDays = 5) => {
  const user = await prisma.user.findFirstOrThrow({ select: { id: true } });
  const run = await prisma.planningRun.create({
    data: { horizonDays, createdById: user.id },
    select: { id: true },
  });
  created.push(run.id);
  await executeRun(run.id);
  return run.id;
};

const deleteRun = async (id: string) => {
  for (const table of ["recommendation", "dRPPlan", "supplyPlan", "inventoryPlan", "forecast", "optimizationResult", "simulationRun"] as const) {
    await (prisma as unknown as Record<string, { deleteMany: (a: unknown) => Promise<unknown> }>)[table]!.deleteMany({
      where: { planningRunId: id },
    });
  }
  await prisma.planningRun.deleteMany({ where: { id } });
};

before(async () => {
  server = await startServer(app);
  for (const run of await prisma.planningRun.findMany({ select: { id: true } })) {
    await deleteRun(run.id);
  }
  runId = await newRun();
});

after(async () => {
  for (const id of created) await deleteRun(id);
  await server.close();
  await Promise.allSettled([disconnectPrisma(), disconnectRedis()]);
});

describe("GET /api/supply-plans", () => {
  test("serves the latest run's orders, soonest first", async () => {
    const body = (await server.json("/api/supply-plans?pageSize=20")) as {
      data: SupplyPlan[];
      meta: { total: number; planningRunId: string };
    };

    assert.ok(body.meta.total > 0, "the run must have proposed supply");
    assert.equal(body.meta.planningRunId, runId, "the page must say which run it came from");
    expectSortedBy(body.data, (plan) => new Date(plan.date).getTime(), "asc");

    for (const plan of body.data) {
      assert.ok(plan.sku && plan.warehouseCode, "labels are inline");
      assert.equal(plan.planningRunId, runId);
    }
  });

  test("filters by status and source", async () => {
    const proposed = (await server.json("/api/supply-plans?status=PROPOSED&pageSize=200")) as {
      data: SupplyPlan[];
    };
    for (const plan of proposed.data) assert.equal(plan.status, "PROPOSED");

    const transfers = (await server.json("/api/supply-plans?source=TRANSFER&pageSize=200")) as {
      data: SupplyPlan[];
    };
    for (const plan of transfers.data) assert.equal(plan.source, "TRANSFER");
  });

  test("404s on an unknown warehouse", async () => {
    assert.equal((await server.get("/api/supply-plans?warehouse=NOPE")).status, 404);
  });
});

describe("PATCH /api/supply-plans/:id", () => {
  const firstProposed = async () => {
    const row = await prisma.supplyPlan.findFirstOrThrow({
      where: { planningRunId: runId, status: "PROPOSED" },
      select: { id: true },
    });
    return row.id;
  };

  test("approving records the decision without moving stock", async () => {
    const id = await firstProposed();

    const before = await prisma.inventory.aggregate({ _sum: { onHand: true } });
    const response = await fetch(`${server.url}/api/supply-plans/${id}/approve`, { method: "PATCH" });
    assert.equal(response.status, 200);

    const { data } = expectEnvelope<SupplyPlan>(await response.json());
    assert.equal(data.status, "APPROVED");

    const after = await prisma.inventory.aggregate({ _sum: { onHand: true } });
    assert.equal(
      after._sum.onHand,
      before._sum.onHand,
      "approving a proposal must not move a single unit",
    );
  });

  test("a decided plan cannot be decided again", async () => {
    const id = await firstProposed();
    await fetch(`${server.url}/api/supply-plans/${id}/reject`, { method: "PATCH" });

    const again = await fetch(`${server.url}/api/supply-plans/${id}/approve`, { method: "PATCH" });
    assert.equal(again.status, 409);
    expectErrorShape(await again.json(), "CONFLICT");
  });

  test("404s on an unknown plan", async () => {
    const response = await fetch(`${server.url}/api/supply-plans/nope/approve`, { method: "PATCH" });
    assert.equal(response.status, 404);
  });
});

describe("GET /api/drp-plans", () => {
  test("reports transfers with both ends labelled and a total for the whole set", async () => {
    const body = (await server.json("/api/drp-plans?pageSize=10")) as {
      data: { items: DrpPlan[]; totalUnits: number };
      meta: { total: number };
    };

    assert.ok(body.meta.total > 0);
    assert.ok(body.data.totalUnits > 0, "totalUnits covers the filtered set, not the page");

    for (const plan of body.data.items) {
      assert.ok(plan.fromWarehouseCode && plan.toWarehouseCode);
      assert.notEqual(plan.fromWarehouseCode, plan.toWarehouseCode, "a transfer to itself is not a transfer");
      assert.ok(plan.quantity > 0);
    }
  });

  test("a warehouse filter matches transfers at either end", async () => {
    const body = (await server.json("/api/drp-plans?warehouse=DC-01&pageSize=200")) as {
      data: { items: DrpPlan[] };
    };

    assert.ok(body.data.items.length > 0);
    for (const plan of body.data.items) {
      assert.ok(
        plan.fromWarehouseCode === "DC-01" || plan.toWarehouseCode === "DC-01",
        "filtering one side only would hide half of what a DC is asked to do",
      );
    }
  });
});

describe("artifact retention", () => {
  test("keeps the newest runs and prunes plans from older ones", async () => {
    const older = runId;
    const newer = await newRun(3);

    const before = await prisma.inventoryPlan.count({ where: { planningRunId: older } });
    assert.ok(before > 0, "the older run must have plans to prune");

    const outcome = await pruneOldRunArtifacts(1);
    assert.equal(outcome.keptRuns, 1);
    assert.ok(outcome.prunedRuns >= 1);

    assert.equal(
      await prisma.inventoryPlan.count({ where: { planningRunId: older } }),
      0,
      "the older run's plans should be gone",
    );
    assert.ok(
      (await prisma.inventoryPlan.count({ where: { planningRunId: newer } })) > 0,
      "the newest run must keep its plans",
    );
  });

  test("forecasts, costs and the run row survive pruning", async () => {
    const older = created[0]!;

    // The evidence base for accuracy, and what /compare reads. Pruning these would
    // silently break measurement against every older run.
    assert.ok(
      (await prisma.forecast.count({ where: { planningRunId: older } })) > 0,
      "forecasts are the evidence base for accuracy and must outlive the plan",
    );
    assert.ok(await prisma.optimizationResult.findUnique({ where: { planningRunId: older } }));
    assert.ok(await prisma.simulationRun.findUnique({ where: { planningRunId: older } }));
    assert.ok(await prisma.planningRun.findUnique({ where: { id: older } }), "history survives");
  });

  test("a keep of zero disables pruning entirely", async () => {
    const outcome = await pruneOldRunArtifacts(0);
    assert.equal(outcome.prunedRuns, 0);
    assert.equal(outcome.deleted.inventoryPlans, 0);
  });
});
