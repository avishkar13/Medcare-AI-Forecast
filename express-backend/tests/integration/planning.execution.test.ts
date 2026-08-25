import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";
import { teardown } from "../helpers/app.js";
import { prisma } from "../../src/config/prisma.js";
import { executeRun } from "../../src/services/planning-executor.service.js";
import { PLANNING } from "../../src/config/constants.js";

const HORIZON = 7;

let systemUserId: string;
const created: string[] = [];

const newRun = async (options: { horizonDays?: number; scenarioId?: string } = {}) => {
  const run = await prisma.planningRun.create({
    data: {
      horizonDays: options.horizonDays ?? HORIZON,
      createdById: systemUserId,
      ...(options.scenarioId === undefined ? {} : { scenarioId: options.scenarioId }),
    },
    select: { id: true },
  });
  created.push(run.id);
  return run.id;
};

const artifactCounts = async (planningRunId: string) => {
  const [forecasts, inventoryPlans, supplyPlans, drpPlans, recommendations] = await Promise.all([
    prisma.forecast.count({ where: { planningRunId } }),
    prisma.inventoryPlan.count({ where: { planningRunId } }),
    prisma.supplyPlan.count({ where: { planningRunId } }),
    prisma.dRPPlan.count({ where: { planningRunId } }),
    prisma.recommendation.count({ where: { planningRunId } }),
  ]);
  return { forecasts, inventoryPlans, supplyPlans, drpPlans, recommendations };
};

before(async () => {
  const user = await prisma.user.findFirst({ select: { id: true } });
  assert.ok(user, "seed data is missing - run pnpm prisma:seed");
  systemUserId = user.id;
});

after(async () => {
  // Runs created here are real rows; leaving them behind would skew the next suite's
  // "one active run at a time" assertions.
  for (const id of created) {
    await prisma.recommendation.deleteMany({ where: { planningRunId: id } });
    await prisma.dRPPlan.deleteMany({ where: { planningRunId: id } });
    await prisma.supplyPlan.deleteMany({ where: { planningRunId: id } });
    await prisma.inventoryPlan.deleteMany({ where: { planningRunId: id } });
    await prisma.forecast.deleteMany({ where: { planningRunId: id } });
    await prisma.optimizationResult.deleteMany({ where: { planningRunId: id } });
    await prisma.simulationRun.deleteMany({ where: { planningRunId: id } });
    await prisma.planningRun.deleteMany({ where: { id } });
  }
  await teardown();
});

describe("executeRun", () => {
  test("takes a PENDING run all the way to COMPLETED", async () => {
    const id = await newRun();
    const outcome = await executeRun(id);

    assert.equal(outcome.status, "COMPLETED");
    assert.equal(outcome.executed, true);

    const run = await prisma.planningRun.findUniqueOrThrow({ where: { id } });
    assert.equal(run.status, "COMPLETED");
    assert.ok(run.startedAt && run.completedAt);
    assert.ok(run.startedAt.getTime() <= run.completedAt.getTime());
    assert.equal(run.failureReason, null);
  });

  test("writes one forecast per pair per horizon day, and as many inventory plans", async () => {
    const id = await newRun();
    await executeRun(id);

    const positions = await prisma.inventory.count();
    const counts = await artifactCounts(id);

    assert.equal(counts.forecasts, positions * HORIZON);
    assert.equal(counts.inventoryPlans, counts.forecasts, "every forecast day gets a plan day");
  });

  test("every forecast band is ordered and non-negative", async () => {
    const id = await newRun();
    await executeRun(id);

    const rows = await prisma.forecast.findMany({ where: { planningRunId: id }, take: 500 });
    assert.ok(rows.length > 0);

    for (const row of rows) {
      assert.ok(row.p10 <= row.p50 && row.p50 <= row.p90, `band out of order on ${row.id}`);
      assert.ok(row.p10 >= 0 && Number.isFinite(row.p90));
    }
  });

  test("transfers never move stock to the warehouse it came from", async () => {
    const id = await newRun();
    await executeRun(id);

    for (const plan of await prisma.dRPPlan.findMany({ where: { planningRunId: id } })) {
      assert.notEqual(plan.fromWarehouseId, plan.toWarehouseId);
      assert.ok(plan.quantity > 0);
    }
  });

  test("the cost roll-up equals its own components", async () => {
    const id = await newRun();
    await executeRun(id);

    const result = await prisma.optimizationResult.findUniqueOrThrow({
      where: { planningRunId: id },
    });

    const sum =
      result.holdingCost + result.stockoutCost + result.transferCost + result.expiryCost;
    assert.ok(Math.abs(result.totalCost - sum) < 0.5, `${result.totalCost} != ${sum}`);
    assert.equal(result.objectiveValue, result.totalCost);

    for (const component of [
      result.holdingCost,
      result.stockoutCost,
      result.transferCost,
      result.expiryCost,
    ]) {
      assert.ok(component >= 0, "no cost component can be negative");
    }
  });

  test("simulation probabilities stay inside their range", async () => {
    const id = await newRun();
    await executeRun(id);

    const simulation = await prisma.simulationRun.findUniqueOrThrow({
      where: { planningRunId: id },
    });

    assert.equal(simulation.iterations, PLANNING.simulationIterations);
    for (const probability of [
      simulation.serviceLevel,
      simulation.stockoutProbability,
      simulation.expiryProbability,
    ]) {
      assert.ok(probability >= 0 && probability <= 1, `${probability} is not a probability`);
    }
    // These are deliberately NOT complements. serviceLevel is a type-2 fill rate -
    // the share of demand met, weighted by volume - while stockoutProbability counts
    // cell-days with any shortfall at all. A day that met 95% of a spike is a stockout
    // day and a good service day at once.
    //
    // They used to sum to exactly 1 because both came from one per-iteration flag,
    // set by any of ~1,000 chances across the network. That pinned serviceLevel at 0
    // and stockoutProbability at 1 on every run, so these two guard the collapse.
    assert.ok(
      simulation.serviceLevel > 0,
      "a fill rate of exactly 0 means the metric collapsed rather than measured",
    );
    assert.ok(
      simulation.stockoutProbability < 1,
      "a stockout probability of exactly 1 means every cell-day was counted as a failure",
    );
  });

  test("the same inputs produce the same cost twice", async () => {
    const first = await newRun();
    await executeRun(first);
    const second = await newRun();
    await executeRun(second);

    const [a, b] = await Promise.all([
      prisma.optimizationResult.findUniqueOrThrow({ where: { planningRunId: first } }),
      prisma.optimizationResult.findUniqueOrThrow({ where: { planningRunId: second } }),
    ]);

    assert.equal(a.totalCost, b.totalCost, "a seeded run must be reproducible");
  });

  test("re-executing a run converges instead of duplicating", async () => {
    const id = await newRun();
    await executeRun(id);
    const before = await artifactCounts(id);

    // Put it back to PENDING so the claim can succeed a second time.
    await prisma.planningRun.update({ where: { id }, data: { status: "PENDING" } });
    const outcome = await executeRun(id);

    assert.equal(outcome.status, "COMPLETED");
    assert.deepEqual(await artifactCounts(id), before);
  });

  test("a run that is not PENDING is left alone", async () => {
    const id = await newRun();
    await executeRun(id);

    const outcome = await executeRun(id);
    assert.equal(outcome.status, "SKIPPED");
    assert.equal(outcome.executed, false);
  });

  test("a demand surge scenario raises safety stock above the baseline", async () => {
    const scenario = await prisma.scenario.findFirst({ where: { demandMultiplier: { gt: 1 } } });
    if (!scenario) return;

    const baselineId = await newRun();
    await executeRun(baselineId);
    const surgeId = await newRun({ scenarioId: scenario.id });
    await executeRun(surgeId);

    const [baseline, surge] = await Promise.all([
      prisma.inventoryPlan.aggregate({
        where: { planningRunId: baselineId },
        _sum: { safetyStock: true, forecastDemand: true },
      }),
      prisma.inventoryPlan.aggregate({
        where: { planningRunId: surgeId },
        _sum: { safetyStock: true, forecastDemand: true },
      }),
    ]);

    assert.ok(
      (surge._sum.forecastDemand ?? 0) > (baseline._sum.forecastDemand ?? 0),
      "the surge must forecast more demand",
    );
    assert.ok(
      (surge._sum.safetyStock ?? 0) > (baseline._sum.safetyStock ?? 0),
      "a sensed surge must widen the band and raise safety stock - this is the sensing-to-plan link",
    );
  });

  test("the executor never touches operational stock", async () => {
    const before = await prisma.inventory.aggregate({ _sum: { onHand: true, reserved: true } });
    const batchesBefore = await prisma.inventoryBatch.aggregate({ _sum: { quantity: true } });

    const id = await newRun();
    await executeRun(id);

    const after = await prisma.inventory.aggregate({ _sum: { onHand: true, reserved: true } });
    const batchesAfter = await prisma.inventoryBatch.aggregate({ _sum: { quantity: true } });

    assert.equal(after._sum.onHand, before._sum.onHand, "a plan is a proposal, not a movement");
    assert.equal(after._sum.reserved, before._sum.reserved);
    assert.equal(batchesAfter._sum.quantity, batchesBefore._sum.quantity);
  });

  test("recommendations are capped and ranked by impact", async () => {
    const id = await newRun();
    await executeRun(id);

    const rows = await prisma.recommendation.findMany({
      where: { planningRunId: id },
      orderBy: { impactValue: "desc" },
    });

    assert.ok(rows.length <= PLANNING.maxRecommendations);
    for (const row of rows) {
      assert.ok(row.impactValue === null || row.impactValue >= 0);
      assert.equal(row.status, "OPEN");
      assert.ok(row.message.length > 0);
    }
  });

  test("a failure records the stage it reached and keeps the artefacts", async () => {
    const id = await newRun();
    // A horizon of zero is impossible to plan; nothing else about the run is unusual.
    await prisma.planningRun.update({ where: { id }, data: { horizonDays: 0 } });

    const outcome = await executeRun(id);
    assert.equal(outcome.status, "FAILED");

    const run = await prisma.planningRun.findUniqueOrThrow({ where: { id } });
    assert.equal(run.status, "FAILED");
    assert.ok(run.failureReason && run.failureReason.length > 0, "a FAILED run must say why");
    assert.ok(run.failureStage && run.failureStage.length > 0);
    assert.ok(run.completedAt);
  });
});
