import { prisma } from "../config/prisma.js";
import { ConflictError, NotFoundError } from "../utils/errors.js";
import { round } from "../utils/inventory.js";
import type { CompareQuery, RunParams } from "../zod/planning.schemas.js";
import type { Delta, RunComparison, RunComparisonSide } from "../types.js";

/**
 * The delta between two completed planning runs.
 *
 * This is the brief's deliverable: "+60% flu spike vs do-nothing" is two runs, and
 * the difference between them is the answer. Everything here is read from artefacts
 * the executor already wrote - nothing is recomputed, so a comparison can never
 * disagree with the runs it describes.
 */

const runSelect = {
  id: true,
  status: true,
  horizonDays: true,
  modelVersion: true,
  completedAt: true,
  scenario: {
    select: { id: true, name: true, demandMultiplier: true, serviceLevelTarget: true },
  },
  optimization: {
    select: {
      holdingCost: true,
      stockoutCost: true,
      transferCost: true,
      expiryCost: true,
      totalCost: true,
    },
  },
  simulation: {
    select: {
      serviceLevel: true,
      stockoutProbability: true,
      expiryProbability: true,
      expectedInventory: true,
      expectedWaste: true,
      expectedCost: true,
    },
  },
};

type LoadedRun = NonNullable<Awaited<ReturnType<typeof loadRun>>>;

/**
 * scenario - baseline. Read the sign against the metric: on a cost a negative delta
 * is a saving, on a service level a positive one is an improvement. The `headline`
 * figures are pre-oriented so a reader never has to.
 */
const delta = (baseline: number, scenario: number): Delta => ({
  baseline: round(baseline),
  scenario: round(scenario),
  delta: round(scenario - baseline),
  percentChange: baseline === 0 ? null : round(((scenario - baseline) / Math.abs(baseline)) * 100),
});

const loadRun = async (id: string, label: string) => {
  const run = await prisma.planningRun.findUnique({ where: { id }, select: runSelect });
  if (!run) throw new NotFoundError(`Planning run '${id}' not found`);

  if (run.status !== "COMPLETED") {
    throw new ConflictError(
      `The ${label} run is ${run.status}; only COMPLETED runs can be compared`,
      { runId: id, status: run.status },
    );
  }

  // A COMPLETED run always has both: the executor writes them in the same transaction
  // as the status flip. Missing means the row was edited outside the pipeline.
  if (!run.optimization || !run.simulation) {
    throw new ConflictError(`Run '${id}' completed without a cost roll-up or a simulation`, {
      runId: id,
    });
  }

  return run;
};

/** Artefact volumes, aggregated in the database rather than pulled across the wire. */
const loadTotals = async (planningRunId: string) => {
  const [transfers, plans, recommendations] = await Promise.all([
    prisma.dRPPlan.aggregate({
      where: { planningRunId },
      _count: true,
      _sum: { quantity: true },
    }),
    // Summing a per-day stockout probability gives expected stockout days - the sum
    // of Bernoulli means. Counting only days over a threshold would discard every
    // near-miss the scenario actually caused.
    prisma.inventoryPlan.aggregate({
      where: { planningRunId },
      _count: true,
      _sum: { stockoutRisk: true, forecastDemand: true, safetyStock: true },
    }),
    prisma.recommendation.count({ where: { planningRunId } }),
  ]);

  return {
    transferCount: transfers._count,
    transferUnits: transfers._sum.quantity ?? 0,
    planCells: plans._count,
    expectedStockoutDays: plans._sum.stockoutRisk ?? 0,
    forecastDemand: plans._sum.forecastDemand ?? 0,
    safetyStock: plans._sum.safetyStock ?? 0,
    recommendations,
  };
};

const toSide = (run: LoadedRun): RunComparisonSide => ({
  id: run.id,
  horizonDays: run.horizonDays,
  modelVersion: run.modelVersion,
  scenario: run.scenario,
  completedAt: run.completedAt?.toISOString() ?? null,
});

export const compareRuns = async (
  { id }: RunParams,
  { baseline }: CompareQuery,
): Promise<RunComparison> => {
  if (id === baseline) {
    throw new ConflictError("A run cannot be compared against itself", { runId: id });
  }

  const [scenarioRun, baselineRun] = await Promise.all([
    loadRun(id, "scenario"),
    loadRun(baseline, "baseline"),
  ]);

  const [scenarioTotals, baselineTotals] = await Promise.all([
    loadTotals(scenarioRun.id),
    loadTotals(baselineRun.id),
  ]);

  const scenarioOpt = scenarioRun.optimization!;
  const baselineOpt = baselineRun.optimization!;
  const scenarioSim = scenarioRun.simulation!;
  const baselineSim = baselineRun.simulation!;

  const warnings: string[] = [];

  // Absolute totals over different horizons are not like for like: a 30-day run
  // holds stock longer than a 7-day one whatever the scenario did. Said out loud
  // rather than silently normalised, because which figure a reader wants depends
  // on the question they are asking.
  if (scenarioRun.horizonDays !== baselineRun.horizonDays) {
    warnings.push(
      `Horizons differ (${baselineRun.horizonDays}d baseline vs ${scenarioRun.horizonDays}d scenario); absolute totals are not directly comparable`,
    );
  }

  if (scenarioRun.modelVersion !== baselineRun.modelVersion) {
    warnings.push(
      `Runs used different forecast models (${baselineRun.modelVersion ?? "unknown"} vs ${scenarioRun.modelVersion ?? "unknown"}); part of the difference is the model, not the scenario`,
    );
  }

  if (scenarioRun.scenario === null && baselineRun.scenario === null) {
    warnings.push("Neither run has a scenario attached, so this compares two baselines");
  }

  return {
    scenario: toSide(scenarioRun),
    baseline: toSide(baselineRun),

    // Oriented so that positive always means the scenario did better.
    headline: {
      stockoutDaysAvoided: round(
        baselineTotals.expectedStockoutDays - scenarioTotals.expectedStockoutDays,
      ),
      writeOffUnitsAvoided: round(baselineSim.expectedWaste - scenarioSim.expectedWaste),
      costSaved: round(baselineOpt.totalCost - scenarioOpt.totalCost),
      serviceLevelChange: round(scenarioSim.serviceLevel - baselineSim.serviceLevel),
      transfersProposed: scenarioTotals.transferCount - baselineTotals.transferCount,
    },

    cost: {
      holding: delta(baselineOpt.holdingCost, scenarioOpt.holdingCost),
      stockout: delta(baselineOpt.stockoutCost, scenarioOpt.stockoutCost),
      transfer: delta(baselineOpt.transferCost, scenarioOpt.transferCost),
      expiry: delta(baselineOpt.expiryCost, scenarioOpt.expiryCost),
      total: delta(baselineOpt.totalCost, scenarioOpt.totalCost),
    },

    risk: {
      serviceLevel: delta(baselineSim.serviceLevel, scenarioSim.serviceLevel),
      stockoutProbability: delta(baselineSim.stockoutProbability, scenarioSim.stockoutProbability),
      expiryProbability: delta(baselineSim.expiryProbability, scenarioSim.expiryProbability),
      expectedInventory: delta(baselineSim.expectedInventory, scenarioSim.expectedInventory),
      expectedWaste: delta(baselineSim.expectedWaste, scenarioSim.expectedWaste),
      expectedCost: delta(baselineSim.expectedCost, scenarioSim.expectedCost),
    },

    plan: {
      forecastDemand: delta(baselineTotals.forecastDemand, scenarioTotals.forecastDemand),
      safetyStock: delta(baselineTotals.safetyStock, scenarioTotals.safetyStock),
      expectedStockoutDays: delta(
        baselineTotals.expectedStockoutDays,
        scenarioTotals.expectedStockoutDays,
      ),
      transfers: delta(baselineTotals.transferCount, scenarioTotals.transferCount),
      transferUnits: delta(baselineTotals.transferUnits, scenarioTotals.transferUnits),
      recommendations: delta(baselineTotals.recommendations, scenarioTotals.recommendations),
    },

    warnings,
  };
};

/**
 * A run's cost roll-up on its own.
 *
 * Separate from `compare` because a single run is a legitimate question - "what did
 * this plan cost" - that should not require inventing a second run to diff against.
 */
export const getOptimization = async ({ id }: RunParams) => {
  const run = await prisma.planningRun.findUnique({
    where: { id },
    select: { id: true, status: true, optimization: true },
  });
  if (!run) throw new NotFoundError(`Planning run '${id}' not found`);

  // A run that never completed has no plan, so it has no cost. 404 rather than an
  // empty body, because the resource genuinely does not exist.
  if (!run.optimization) {
    throw new NotFoundError(
      `Planning run '${id}' produced no optimization result (status ${run.status})`,
    );
  }

  const { planningRunId, createdAt, ...result } = run.optimization;
  return {
    planningRunId,
    ...result,
    // The components must add up to the total; returned so a caller can check.
    componentSum: round(
      result.holdingCost + result.stockoutCost + result.transferCost + result.expiryCost,
    ),
    createdAt: createdAt.toISOString(),
  };
};

export const getSimulation = async ({ id }: RunParams) => {
  const run = await prisma.planningRun.findUnique({
    where: { id },
    select: { id: true, status: true, simulation: true },
  });
  if (!run) throw new NotFoundError(`Planning run '${id}' not found`);

  if (!run.simulation) {
    throw new NotFoundError(
      `Planning run '${id}' produced no simulation (status ${run.status})`,
    );
  }

  const { planningRunId, createdAt, ...result } = run.simulation;
  return { planningRunId, ...result, createdAt: createdAt.toISOString() };
};
