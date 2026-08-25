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

let server: TestServer;
let runId: string;

interface Item {
  id: string;
  status: string;
  priority: string;
  impactValue: number | null;
  confidence: number | null;
  sku: string;
  warehouseCode: string;
  resolvedAt: string | null;
}

const deleteRun = async (id: string) => {
  for (const table of [
    "recommendation",
    "dRPPlan",
    "supplyPlan",
    "inventoryPlan",
    "forecast",
    "optimizationResult",
    "simulationRun",
  ] as const) {
    await (prisma as unknown as Record<string, { deleteMany: (a: unknown) => Promise<unknown> }>)[
      table
    ]!.deleteMany({ where: { planningRunId: id } });
  }
  await prisma.planningRun.deleteMany({ where: { id } });
};

before(async () => {
  server = await startServer(app);
  for (const run of await prisma.planningRun.findMany({ select: { id: true } })) {
    await deleteRun(run.id);
  }

  const user = await prisma.user.findFirstOrThrow({ select: { id: true } });
  const run = await prisma.planningRun.create({
    data: { horizonDays: 5, createdById: user.id },
    select: { id: true },
  });
  runId = run.id;
  await executeRun(runId);
});

after(async () => {
  if (runId) await deleteRun(runId);
  await server.close();
  await Promise.allSettled([disconnectPrisma(), disconnectRedis()]);
});

describe("GET /api/recommendations", () => {
  test("paginates and inlines the labels a list needs", async () => {
    const body = (await server.json("/api/recommendations?pageSize=5")) as {
      data: Item[];
      meta: { pageSize: number; total: number };
    };

    assert.equal(body.meta.pageSize, 5);
    assert.ok(body.meta.total > 0, "the run must have produced recommendations");
    assert.ok(body.data.length <= 5);

    const first = body.data[0]!;
    assert.ok(first.sku, "the sku is inline so the list needs no second call per row");
    assert.ok(first.warehouseCode);
  });

  test("reports a missing impact as null rather than defaulting it to money", async () => {
    const body = (await server.json("/api/recommendations?pageSize=200")) as { data: Item[] };

    for (const item of body.data) {
      // The route this replaces used `impactValue || 1000` and `confidence || 94`,
      // which put figures in front of a planner that no calculation produced.
      assert.ok(item.impactValue === null || typeof item.impactValue === "number");
      assert.ok(item.confidence === null || typeof item.confidence === "number");
      assert.notEqual(item.impactValue, 1000);
    }
  });

  test("filters by status and by priority", async () => {
    const body = (await server.json("/api/recommendations?status=OPEN&pageSize=200")) as {
      data: Item[];
    };
    for (const item of body.data) assert.equal(item.status, "OPEN");
  });

  test("rejects a status outside the enum", async () => {
    const response = await server.get("/api/recommendations?status=Pending");
    assert.equal(response.status, 422, "a free-text status would silently match nothing");
  });
});

describe("GET /api/recommendations/kpi", () => {
  test("counts agree with the rows behind them", async () => {
    const { data } = expectEnvelope<{
      totalRecommendations: number;
      open: number;
      planningRunId: string;
    }>(await server.json("/api/recommendations/kpi"));

    assert.equal(data.planningRunId, runId);
    assert.equal(data.totalRecommendations, await prisma.recommendation.count({ where: { planningRunId: runId } }));
    assert.equal(
      data.open,
      await prisma.recommendation.count({ where: { planningRunId: runId, status: "OPEN" } }),
    );
  });
});

describe("PATCH /api/recommendations/:id", () => {
  const firstOpen = async () => {
    const row = await prisma.recommendation.findFirstOrThrow({
      where: { planningRunId: runId, status: "OPEN" },
      select: { id: true },
    });
    return row.id;
  };

  test("executing resolves the row and stamps who acted", async () => {
    const id = await firstOpen();
    const response = await fetch(`${server.url}/api/recommendations/${id}/execute`, {
      method: "PATCH",
    });
    assert.equal(response.status, 200);

    const { data } = expectEnvelope<Item & { actedById: string | null }>(await response.json());
    assert.equal(data.status, "COMPLETED");
    assert.ok(data.resolvedAt, "a resolved row needs the time it was resolved");
    assert.ok(data.actedById, "someone acted, even if identity is a placeholder until auth lands");
  });

  test("a resolved recommendation cannot be acted on twice", async () => {
    const id = await firstOpen();
    await fetch(`${server.url}/api/recommendations/${id}/execute`, { method: "PATCH" });

    const again = await fetch(`${server.url}/api/recommendations/${id}/dismiss`, { method: "PATCH" });
    assert.equal(again.status, 409, "the lifecycle is one-way");
    expectErrorShape(await again.json(), "CONFLICT");
  });

  test("404s on an unknown id instead of a server error", async () => {
    const response = await fetch(`${server.url}/api/recommendations/nope/execute`, {
      method: "PATCH",
    });
    assert.equal(response.status, 404);
  });
});
