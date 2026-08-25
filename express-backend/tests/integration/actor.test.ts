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
const { expectEnvelope } = await import("../helpers/assertions.js");

import type { TestServer } from "../helpers/server.js";

/**
 * The seam auth will plug into.
 *
 * Nothing here asserts *who* the actor is - that is a placeholder today. What it
 * asserts is that whatever `req.userId` holds is what lands on the row, so wiring
 * real authentication in front of it changes the actor without touching any of the
 * code that records one.
 */

let server: TestServer;
let runId: string;
let systemUserId: string;
let otherUserId: string;

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

  const system = await prisma.user.findFirstOrThrow({ select: { id: true } });
  systemUserId = system.id;

  const other = await prisma.user.upsert({
    where: { email: "actor-test@medcare.local" },
    update: {},
    create: { email: "actor-test@medcare.local", name: "Actor Test", passwordHash: "!" },
    select: { id: true },
  });
  otherUserId = other.id;

  const run = await prisma.planningRun.create({
    data: { horizonDays: 3, createdById: systemUserId },
    select: { id: true },
  });
  runId = run.id;
  await executeRun(runId);
});

after(async () => {
  if (runId) await deleteRun(runId);
  await prisma.user.deleteMany({ where: { email: "actor-test@medcare.local" } });
  await server.close();
  await Promise.allSettled([disconnectPrisma(), disconnectRedis()]);
});

const openRecommendation = async () => {
  const row = await prisma.recommendation.findFirstOrThrow({
    where: { planningRunId: runId, status: "OPEN" },
    select: { id: true },
  });
  return row.id;
};

describe("the acting user", () => {
  test("defaults to a real user so the foreign key holds", async () => {
    const id = await openRecommendation();
    const response = await fetch(`${server.url}/api/recommendations/${id}/execute`, {
      method: "PATCH",
    });

    const { data } = expectEnvelope<{ actedById: string | null }>(await response.json());
    assert.equal(data.actedById, systemUserId, "with nobody authenticated, the stand-in acts");
  });

  test("whatever req.userId holds is what lands on the row", async () => {
    const id = await openRecommendation();

    // Stands in for what an auth middleware will do: put a user on the request.
    const response = await fetch(`${server.url}/api/recommendations/${id}/dismiss`, {
      method: "PATCH",
      headers: { "x-user-id": otherUserId },
    });

    const { data } = expectEnvelope<{ actedById: string | null; status: string }>(
      await response.json(),
    );
    assert.equal(data.status, "REJECTED");
    assert.equal(
      data.actedById,
      otherUserId,
      "the recorded actor must follow req.userId, or auth will not change who acts",
    );
  });

  test("an id that is not a real user falls back instead of failing the write", async () => {
    const id = await openRecommendation();

    const response = await fetch(`${server.url}/api/recommendations/${id}/execute`, {
      method: "PATCH",
      headers: { "x-user-id": "not-a-real-user" },
    });

    assert.equal(response.status, 200, "a bad actor id must not break the transition");
    const { data } = expectEnvelope<{ actedById: string | null }>(await response.json());
    assert.equal(
      data.actedById,
      systemUserId,
      "an unknown id would violate the foreign key, so it falls back",
    );
  });

  test("a created run records who created it", async () => {
    const response = await server.post(
      "/api/planning/runs",
      { horizonDays: 3 },
      { "x-user-id": otherUserId },
    );

    const { data } = expectEnvelope<{ id: string; createdById: string }>(await response.json());
    await deleteRun(data.id);

    assert.equal(data.createdById, otherUserId, "createdById uses the same seam as actedById");
  });

  test("a created scenario records who created it", async () => {
    const response = await server.post(
      "/api/scenarios",
      { name: `actor-test-${Date.now()}` },
      { "x-user-id": otherUserId },
    );

    const { data } = expectEnvelope<{ id: string; createdById: string }>(await response.json());
    await prisma.scenario.deleteMany({ where: { id: data.id } });

    assert.equal(data.createdById, otherUserId);
  });
});
