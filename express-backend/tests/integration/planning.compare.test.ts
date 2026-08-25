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
import type { RunComparison } from "../../src/types.js";

const HORIZON = 7;

let server: TestServer;
let systemUserId: string;
let scenarioId: string;
let baselineRunId: string;
let surgeRunId: string;

const created: string[] = [];

const newRun = async (options: { scenarioId?: string; horizonDays?: number } = {}) => {
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

const deleteRun = async (id: string) => {
  await prisma.recommendation.deleteMany({ where: { planningRunId: id } });
  await prisma.dRPPlan.deleteMany({ where: { planningRunId: id } });
  await prisma.supplyPlan.deleteMany({ where: { planningRunId: id } });
  await prisma.inventoryPlan.deleteMany({ where: { planningRunId: id } });
  await prisma.forecast.deleteMany({ where: { planningRunId: id } });
  await prisma.optimizationResult.deleteMany({ where: { planningRunId: id } });
  await prisma.simulationRun.deleteMany({ where: { planningRunId: id } });
  await prisma.planningRun.deleteMany({ where: { id } });
};

const compare = (id: string, baseline: string) =>
  server.get(`/api/planning/runs/${id}/compare?baseline=${baseline}`);

before(async () => {
  server = await startServer(app);

  const user = await prisma.user.findFirst({ select: { id: true } });
  assert.ok(user, "seed data is missing - run pnpm prisma:seed");
  systemUserId = user.id;

  const scenario = await prisma.scenario.create({
    data: {
      name: "compare-test flu surge",
      demandMultiplier: 1.6,
      serviceLevelTarget: 0.98,
      createdById: systemUserId,
    },
    select: { id: true },
  });
  scenarioId = scenario.id;

  // Two real runs through the executor. Comparing hand-written rows would prove the
  // arithmetic and nothing about whether a surge actually moves the plan.
  baselineRunId = await newRun();
  await executeRun(baselineRunId);

  surgeRunId = await newRun({ scenarioId });
  await executeRun(surgeRunId);
});

after(async () => {
  for (const id of created) await deleteRun(id);
  await prisma.scenario.deleteMany({ where: { id: scenarioId } });
  await server.close();
  await Promise.allSettled([disconnectPrisma(), disconnectRedis()]);
});

describe("GET /api/planning/runs/:id/compare", () => {
  test("a +60% surge raises safety stock and degrades service", async () => {
    const response = await compare(surgeRunId, baselineRunId);
    assert.equal(response.status, 200);

    const { data, meta } = expectEnvelope<RunComparison>(await response.json());

    assert.equal(data.scenario.id, surgeRunId);
    assert.equal(data.baseline.id, baselineRunId);
    assert.equal(data.scenario.scenario?.demandMultiplier, 1.6);
    assert.equal(meta.planningRunId, surgeRunId);

    // The sensing -> plan chain: more demand widens the band, which raises safety
    // stock, which is what the brief asks the planner to do about a surge.
    assert.ok(
      data.plan.forecastDemand.delta > 0,
      "a 1.6x demand multiplier must raise forecast demand",
    );
    assert.ok(
      data.plan.safetyStock.delta > 0,
      "more demand and a higher service target must raise safety stock",
    );

    // Service degrades and shortages cost more - the surge is genuinely harder to serve.
    assert.ok(data.risk.serviceLevel.delta < 0, "a surge must reduce the fill rate");
    assert.ok(data.cost.stockout.delta > 0, "a surge must cost more in shortages");
    assert.ok(data.plan.expectedStockoutDays.delta > 0);
  });

  test("a surge consumes near-expiry stock, so write-offs fall", async () => {
    const { data } = expectEnvelope<RunComparison>(await (await compare(surgeRunId, baselineRunId)).json());

    // Counter-intuitive but real, and the reason total cost can fall under a surge:
    // expiry dominates the cost model here, and extra demand clears stock that would
    // otherwise have been written off. It is the brief's own observation - metro DCs
    // sitting on excess near-expiry stock - showing up in the numbers.
    assert.ok(data.cost.expiry.delta < 0, "higher demand must burn down near-expiry stock");
    assert.ok(data.headline.writeOffUnitsAvoided > 0, "waste avoided is oriented positive");
    assert.equal(
      data.headline.writeOffUnitsAvoided,
      -data.risk.expectedWaste.delta,
      "the headline is the mirror of the underlying delta",
    );
  });

  test("headline figures are oriented so positive always means better", async () => {
    const { data } = expectEnvelope<RunComparison>(await (await compare(surgeRunId, baselineRunId)).json());

    // costSaved is baseline - scenario, the mirror of cost.total.delta.
    assert.equal(data.headline.costSaved, -data.cost.total.delta);
    assert.equal(
      data.headline.stockoutDaysAvoided,
      -data.plan.expectedStockoutDays.delta,
      "stockout days avoided is the baseline minus the scenario",
    );
    assert.equal(data.headline.serviceLevelChange, data.risk.serviceLevel.delta);
  });

  test("every delta equals scenario minus baseline", async () => {
    const { data } = expectEnvelope<RunComparison>(await (await compare(surgeRunId, baselineRunId)).json());

    for (const group of [data.cost, data.risk, data.plan]) {
      for (const [name, value] of Object.entries(group)) {
        assert.ok(
          Math.abs(value.scenario - value.baseline - value.delta) < 0.02,
          `${name}: ${value.scenario} - ${value.baseline} != ${value.delta}`,
        );
      }
    }
  });

  test("the cost components still sum to the total on both sides", async () => {
    const { data } = expectEnvelope<RunComparison>(await (await compare(surgeRunId, baselineRunId)).json());

    for (const side of ["baseline", "scenario"] as const) {
      const parts =
        data.cost.holding[side] +
        data.cost.stockout[side] +
        data.cost.transfer[side] +
        data.cost.expiry[side];
      assert.ok(
        Math.abs(parts - data.cost.total[side]) < 0.5,
        `${side}: components ${parts} do not sum to total ${data.cost.total[side]}`,
      );
    }
  });

  test("comparing identical runs is refused rather than answered with zeros", async () => {
    const response = await compare(surgeRunId, surgeRunId);
    assert.equal(response.status, 409);
    expectErrorShape(await response.json(), "CONFLICT");
  });

  test("a run that has not completed cannot be compared", async () => {
    const pending = await newRun();

    const asScenario = await compare(pending, baselineRunId);
    assert.equal(asScenario.status, 409, "a PENDING scenario run has no artefacts to compare");
    const { error } = expectErrorShape(await asScenario.json(), "CONFLICT");
    assert.equal((error.details as { status: string }).status, "PENDING");

    const asBaseline = await compare(surgeRunId, pending);
    assert.equal(asBaseline.status, 409, "a PENDING baseline is no baseline");
  });

  test("404s on an unknown run, on either side", async () => {
    assert.equal((await compare("does-not-exist", baselineRunId)).status, 404);
    assert.equal((await compare(surgeRunId, "does-not-exist")).status, 404);
  });

  test("requires an explicit baseline", async () => {
    const response = await server.get(`/api/planning/runs/${surgeRunId}/compare`);
    assert.equal(response.status, 422, "a silently defaulted baseline would change meaning over time");
    expectErrorShape(await response.json(), "VALIDATION_FAILED");
  });

  test("optimization and simulation are readable on their own", async () => {
    const optimization = await server.get(`/api/planning/runs/${surgeRunId}/optimization`);
    assert.equal(optimization.status, 200);

    const opt = expectEnvelope<{
      planningRunId: string;
      totalCost: number;
      componentSum: number;
      solver: string;
    }>(await optimization.json());

    assert.equal(opt.data.planningRunId, surgeRunId);
    assert.equal(opt.data.solver, "greedy-drp");
    assert.ok(
      Math.abs(opt.data.componentSum - opt.data.totalCost) < 0.5,
      "the components must add up to the total they are shown beside",
    );

    const simulation = await server.get(`/api/planning/runs/${surgeRunId}/simulation`);
    assert.equal(simulation.status, 200);

    const sim = expectEnvelope<{ planningRunId: string; serviceLevel: number; iterations: number }>(
      await simulation.json(),
    );
    assert.equal(sim.data.planningRunId, surgeRunId);
    assert.ok(sim.data.serviceLevel > 0 && sim.data.serviceLevel <= 1);
    assert.ok(sim.data.iterations > 0);
  });

  test("a run with no artefacts 404s rather than returning an empty body", async () => {
    const pending = await newRun();

    for (const route of ["optimization", "simulation"]) {
      const response = await server.get(`/api/planning/runs/${pending}/${route}`);
      assert.equal(response.status, 404, `${route} does not exist for a PENDING run`);
      expectErrorShape(await response.json(), "NOT_FOUND");
    }

    assert.equal((await server.get("/api/planning/runs/nope/optimization")).status, 404);
  });

  test("mismatched horizons are flagged rather than silently compared", async () => {
    const shortRun = await newRun({ horizonDays: 3 });
    await executeRun(shortRun);

    const { data } = expectEnvelope<RunComparison>(await (await compare(shortRun, baselineRunId)).json());

    assert.ok(
      data.warnings.some((warning) => warning.includes("Horizons differ")),
      "absolute totals over different horizons are not like for like",
    );
  });

  test("two baseline runs produce no scenario and say so", async () => {
    const second = await newRun();
    await executeRun(second);

    const { data } = expectEnvelope<RunComparison>(await (await compare(second, baselineRunId)).json());

    assert.equal(data.scenario.scenario, null);
    assert.ok(data.warnings.some((warning) => warning.includes("two baselines")));

    // Same inputs, same seed, same horizon: the cost must reproduce exactly. A run
    // that cannot be reproduced cannot be compared against another one.
    assert.equal(data.cost.total.delta, 0, "two identical baselines must cost the same");
  });
});
