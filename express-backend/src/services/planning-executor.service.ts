import { PLANNING } from "../config/constants.js";
import { prisma } from "../config/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import {
  loadPlanningInputs,
  pairKey,
  settingsOf,
  type PlanningInputs,
  type PlanningParameters,
  type ScenarioSettings,
} from "../lib/planning-inputs.js";
import {
  clearRunArtifacts,
  completeRun,
  writeDrpPlans,
  writeForecasts,
  writeInventoryPlans,
  writeSupplyPlans,
} from "../lib/planning-writer.js";
import { forecastDemand } from "./forecast.service.js";
import { planTransfers } from "../utils/allocation.js";
import {
  expectedShortfall,
  normalCdf,
  orderUpToLevel,
  projectFefoWaste,
  round,
  safetyStock,
  stdDevFromBand,
} from "../utils/inventory.js";
import { createRng } from "../utils/random.js";
import type { InventoryPosition } from "./dashboard.service.js";
import type { ForecastPointBand } from "../types.js";

const MS_PER_DAY = 86_400_000;

const DEFAULT_PARAMETERS: PlanningParameters = {
  leadTimeDays: 7,
  leadTimeStdDev: 0,
  serviceLevel: 0.95,
  reviewPeriodDays: 7,
  minimumOrderQty: 0,
  maximumInventory: null,
  holdingCostPerUnit: 0,
  stockoutCostPerUnit: 0,
  expiryCostPerUnit: 0,
};

export type ExecutorStage =
  | "inputs"
  | "forecast"
  | "projection"
  | "allocation"
  | "supply"
  | "optimization"
  | "simulation"
  | "recommendations"
  | "complete";

/**
 * How far through a run each stage is, as a percentage.
 *
 * The day loop (projection -> allocation -> supply) is the long part, so it spans a
 * wide band and reports by day rather than by sub-stage. 100 is deliberately absent:
 * it is written by `completeRun`, in the same transaction as the COMPLETED flip, so
 * a client can never see 100% on a run that is still working.
 */
const STAGE_PROGRESS: Record<ExecutorStage, number> = {
  inputs: 5,
  forecast: 15,
  projection: 35,
  allocation: 45,
  supply: 55,
  optimization: 80,
  simulation: 90,
  recommendations: 95,
  complete: 98,
};

const DAY_LOOP_START = STAGE_PROGRESS.projection;
const DAY_LOOP_END = STAGE_PROGRESS.optimization;
// A write per day would be 30 round trips for a 30-day run to move a progress bar.
const PROGRESS_STEP = 5;

export class PlanningExecutionError extends Error {
  readonly stage: ExecutorStage;

  constructor(stage: ExecutorStage, message: string, options?: { cause?: unknown }) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "PlanningExecutionError";
    this.stage = stage;
  }
}

export interface ExecutionOutcome {
  executed: boolean;
  status: "COMPLETED" | "FAILED" | "SKIPPED";
  modelVersion?: string;
  counts?: Record<string, number>;
}

const startOfDay = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * MS_PER_DAY);

const meanOf = (values: number[]) =>
  values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;

// A short, safe sentence for the API. Never a stack trace, never a connection string.
const failureReasonOf = (error: unknown): string => {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.replace(/(postgres(?:ql)?|redis):\/\/[^\s"']+/gi, "[redacted]").slice(0, 500);
};

interface Cell {
  position: InventoryPosition;
  parameters: PlanningParameters;
  forecast: ForecastPointBand[];
  leadTimeDays: number;
  safetyStock: number;
  reorderPoint: number;
  maximumInventory: number | null;
  onHand: number;
  arrivals: Map<number, number>;
  demandTotal: number;
  shortfallUnits: number;
  wasteRescued: number;
  holdingUnitDays: number;
}

/**
 * Forward-looking demand profile.
 *
 * This is the join between demand sensing and the plan: mean and spread come from the
 * forecast band over the lead-time window, not from history. A sensed surge widens the
 * band, which raises safety stock, which fires replenishment earlier - outcome 1
 * driving outcomes 3 and 4 without anything downstream having to know about it.
 */
const profileOf = (
  forecast: ForecastPointBand[],
  parameters: PlanningParameters,
  scenario: ScenarioSettings,
) => {
  const leadTimeDays = Math.max(
    1,
    Math.round(parameters.leadTimeDays * scenario.leadTimeMultiplier),
  );
  const window = forecast.slice(0, leadTimeDays);

  const avgDailyDemand = meanOf(window.map((point) => point.p50));
  const demandStdDev = meanOf(window.map((point) => stdDevFromBand(point.p10, point.p90)));

  const buffer = safetyStock({
    avgDailyDemand,
    demandStdDev,
    leadTimeDays,
    leadTimeStdDev: parameters.leadTimeStdDev,
    // The pair's own target unless a scenario overrides it. Reading only the
    // scenario made PlanningParameter.serviceLevel dead: a critical SKU at a Tier-2
    // DC planned to the same buffer as a routine one at a metro DC.
    serviceLevel: scenario.serviceLevelTarget ?? parameters.serviceLevel,
  });

  return {
    leadTimeDays,
    safetyStock: round(buffer),
    reorderPoint: round(avgDailyDemand * leadTimeDays + buffer),
  };
};

const buildCells = (
  inputs: PlanningInputs,
  forecasts: Map<string, ForecastPointBand[]>,
  scenario: ScenarioSettings,
): Cell[] =>
  inputs.positions.map((position) => {
    const key = pairKey(position.productId, position.warehouseId);
    const parameters = inputs.parameters.get(key) ?? DEFAULT_PARAMETERS;

    // The scenario scales demand here, after the forecast, so one forecast can be
    // re-scored under several scenarios without refitting anything.
    const forecast = (forecasts.get(key) ?? []).map((point) => ({
      p10: point.p10 * scenario.demandMultiplier,
      p50: point.p50 * scenario.demandMultiplier,
      p90: point.p90 * scenario.demandMultiplier,
    }));

    const profile = profileOf(forecast, parameters, scenario);
    const arrivals = new Map<number, number>();
    if (position.inTransit > 0) arrivals.set(profile.leadTimeDays, position.inTransit);

    return {
      position,
      parameters,
      forecast,
      leadTimeDays: profile.leadTimeDays,
      safetyStock: profile.safetyStock,
      reorderPoint: profile.reorderPoint,
      maximumInventory:
        parameters.maximumInventory === null
          ? null
          : parameters.maximumInventory * scenario.capacityMultiplier,
      onHand: Math.max(0, position.onHand - position.reserved),
      arrivals,
      demandTotal: 0,
      shortfallUnits: 0,
      wasteRescued: 0,
      holdingUnitDays: 0,
    };
  });

const addArrival = (cell: Cell, day: number, quantity: number) => {
  if (quantity <= 0) return;
  cell.arrivals.set(day, (cell.arrivals.get(day) ?? 0) + quantity);
};

const wasteUnitsOf = (cell: Cell, inputs: PlanningInputs, days: number): number => {
  const batches =
    inputs.batches.get(pairKey(cell.position.productId, cell.position.warehouseId)) ?? [];
  const daily = cell.demandTotal / Math.max(1, days);
  return projectFefoWaste(batches, daily).reduce((total, units) => total + units, 0);
};

const priorityOf = (
  criticality: string,
  severe: boolean,
): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" => {
  if (severe) return criticality === "CRITICAL" || criticality === "HIGH" ? "CRITICAL" : "HIGH";
  return criticality === "CRITICAL" ? "HIGH" : "MEDIUM";
};

const buildRecommendations = (
  runId: string,
  cells: Cell[],
  drpPlans: Prisma.DRPPlanCreateManyInput[],
): Prisma.RecommendationCreateManyInput[] => {
  const rows: Prisma.RecommendationCreateManyInput[] = [];

  for (const cell of cells) {
    const { position } = cell;

    if (cell.shortfallUnits >= 1) {
      const severe = cell.onHand < cell.safetyStock;
      rows.push({
        planningRunId: runId,
        productId: position.productId,
        warehouseId: position.warehouseId,
        type: "STOCKOUT_RISK",
        priority: priorityOf(position.criticality, severe),
        message: `${position.sku} at ${position.warehouseCode}: ${Math.round(cell.shortfallUnits)} units of expected shortfall across the horizon`,
        quantity: round(cell.shortfallUnits),
        impactValue: round(cell.shortfallUnits * cell.parameters.stockoutCostPerUnit),
      });
    }

    if (cell.maximumInventory !== null && cell.onHand > cell.maximumInventory) {
      const excess = cell.onHand - cell.maximumInventory;
      rows.push({
        planningRunId: runId,
        productId: position.productId,
        warehouseId: position.warehouseId,
        type: "REDUCE_SUPPLY",
        priority: "LOW",
        message: `${position.sku} at ${position.warehouseCode}: ${Math.round(excess)} units above maximum at the end of the horizon`,
        quantity: round(excess),
        impactValue: round(excess * cell.parameters.holdingCostPerUnit),
      });
    }
  }

  for (const plan of drpPlans) {
    const destination = cells.find(
      (cell) =>
        cell.position.productId === plan.productId &&
        cell.position.warehouseId === plan.toWarehouseId,
    );
    if (!destination) continue;

    rows.push({
      planningRunId: runId,
      productId: plan.productId,
      warehouseId: plan.toWarehouseId,
      type: "TRANSFER_STOCK",
      priority: priorityOf(destination.position.criticality, true),
      message: plan.reason ?? `Transfer ${Math.round(plan.quantity)} units`,
      quantity: plan.quantity,
      impactValue: round(plan.quantity * destination.position.stockoutCostPerUnit),
    });
  }

  return rows
    .sort((left, right) => (right.impactValue ?? 0) - (left.impactValue ?? 0))
    .slice(0, PLANNING.maxRecommendations);
};

/**
 * Turns a PENDING run into a COMPLETED one with artefacts, or a FAILED one with a
 * reason. Takes a run id, returns an outcome, touches no HTTP concern.
 *
 * It never mutates operational state: Inventory, InventoryBatch, DemandHistory and
 * DistributorOrder are read-only here. A DRPPlan is a proposal; nothing moves stock.
 */
export const executeRun = async (runId: string): Promise<ExecutionOutcome> => {
  // The claim is a compare-and-swap, not the Redis lock: it survives Redis being down
  // and it cannot expire underneath a run that is still working.
  const claimed = await prisma.planningRun.updateMany({
    where: { id: runId, status: "PENDING" },
    data: { status: "RUNNING", startedAt: new Date(), failureReason: null, failureStage: null },
  });

  if (claimed.count === 0) return { executed: false, status: "SKIPPED" };

  let stage: ExecutorStage = "inputs";
  let reported = -1;

  /**
   * Records where the run has got to. Monotonic by construction: a lower percentage
   * is dropped, which also stops the day loop flapping between projection,
   * allocation and supply on every iteration.
   */
  const report = async (next: ExecutorStage, percent = STAGE_PROGRESS[next]) => {
    if (percent < reported + (percent === STAGE_PROGRESS[next] ? 1 : PROGRESS_STEP)) return;
    reported = percent;
    // updateMany, so a run deleted mid-flight does not throw on the way past.
    await prisma.planningRun.updateMany({
      where: { id: runId },
      data: { currentStage: next, progress: percent },
    });
  };

  try {
    await report("inputs");
    const run = await prisma.planningRun.findUniqueOrThrow({
      where: { id: runId },
      select: { horizonDays: true, scenarioId: true, modelVersion: true },
    });

    // Re-running the same run converges rather than duplicating.
    await clearRunArtifacts(runId);

    const inputs = await loadPlanningInputs(run.scenarioId);
    const scenario = settingsOf(inputs);
    const horizonDays = run.horizonDays;
    const asOf = startOfDay(new Date());

    if (inputs.positions.length === 0) {
      throw new PlanningExecutionError("inputs", "no inventory positions exist to plan");
    }

    // The API caps this at 1-365, but a row can be written directly. Without the
    // guard a zero horizon completes with no artefacts at all - a plan for nothing,
    // reported as success.
    if (horizonDays < 1) {
      throw new PlanningExecutionError("inputs", `horizon of ${horizonDays} days plans nothing`);
    }

    stage = "forecast";
    await report("forecast");
    const forecast = await forecastDemand({ runId, horizonDays, asOf, pairs: inputs.pairs });
    const byPair = new Map(
      forecast.series.map((series) => [
        pairKey(series.productId, series.warehouseId),
        series.points,
      ]),
    );

    const forecastRows: Prisma.ForecastCreateManyInput[] = [];
    for (const series of forecast.series) {
      for (const [index, point] of series.points.entries()) {
        forecastRows.push({
          planningRunId: runId,
          productId: series.productId,
          warehouseId: series.warehouseId,
          forecastDate: addDays(asOf, index + 1),
          p10: round(point.p10),
          p50: round(point.p50),
          p90: round(point.p90),
          modelVersion: forecast.modelVersion,
        });
      }
    }
    await writeForecasts(forecastRows);

    stage = "projection";
    await report("projection");
    const cells = buildCells(inputs, byPair, scenario);

    const byProduct = new Map<string, Cell[]>();
    for (const cell of cells) {
      const bucket = byProduct.get(cell.position.productId);
      if (bucket) bucket.push(cell);
      else byProduct.set(cell.position.productId, [cell]);
    }

    const inventoryPlans: Prisma.InventoryPlanCreateManyInput[] = [];
    const drpPlans: Prisma.DRPPlanCreateManyInput[] = [];
    const supplyPlans: Prisma.SupplyPlanCreateManyInput[] = [];

    for (const cell of cells) {
      if (cell.position.inTransit <= 0) continue;
      supplyPlans.push({
        planningRunId: runId,
        productId: cell.position.productId,
        warehouseId: cell.position.warehouseId,
        date: addDays(asOf, cell.leadTimeDays),
        quantity: round(cell.position.inTransit),
        source: "EXISTING",
      });
    }

    // One forward pass. Projection, transfers and order releases are interdependent -
    // an arrival changes the projection, and a transfer decision for a day depends on
    // every warehouse's position on that same day - so they cannot be three passes.
    for (let day = 1; day <= horizonDays; day += 1) {
      const date = addDays(asOf, day);

      await report(
        stage,
        DAY_LOOP_START + Math.round((day / horizonDays) * (DAY_LOOP_END - DAY_LOOP_START)),
      );

      for (const cell of cells) {
        const point = cell.forecast[day - 1] ?? { p10: 0, p50: 0, p90: 0 };
        const opening = cell.onHand + (cell.arrivals.get(day) ?? 0);
        const demand = point.p50;
        const projected = Math.max(0, opening - demand);
        const stdDev = stdDevFromBand(point.p10, point.p90);

        cell.demandTotal += demand;
        cell.shortfallUnits += expectedShortfall({
          demandMean: demand,
          demandStdDev: stdDev,
          availableUnits: opening,
        });
        cell.holdingUnitDays += projected;

        const stockoutRisk =
          stdDev > 0
            ? Math.min(1, Math.max(0, 1 - normalCdf((opening - demand) / stdDev)))
            : opening < demand
              ? 1
              : 0;

        inventoryPlans.push({
          planningRunId: runId,
          productId: cell.position.productId,
          warehouseId: cell.position.warehouseId,
          date,
          forecastDemand: round(demand),
          safetyStock: cell.safetyStock,
          reorderPoint: cell.reorderPoint,
          openingInventory: round(opening),
          projectedInventory: round(projected),
          netRequirement: round(Math.max(0, cell.reorderPoint - projected)),
          daysOfSupply: demand > 0 ? round(projected / demand, 1) : null,
          stockoutRisk: round(stockoutRisk, 4),
          expiryRisk: null,
        });

        cell.onHand = projected;
      }

      stage = "allocation";
      for (const [productId, group] of byProduct) {
        if (group.length < 2) continue;

        const transfers = planTransfers({
          positions: group,
          wasteUnitsOf: (cell) => wasteUnitsOf(cell, inputs, day),
          minimumUnits: 1,
        });

        for (const transfer of transfers) {
          const arrivalDay = Math.min(
            horizonDays,
            day + Math.max(1, Math.round(transfer.destination.leadTimeDays / 2)),
          );

          transfer.source.onHand = Math.max(0, transfer.source.onHand - transfer.quantity);
          transfer.source.wasteRescued += transfer.unitsRescued;
          addArrival(transfer.destination, arrivalDay, transfer.quantity);

          drpPlans.push({
            planningRunId: runId,
            productId,
            fromWarehouseId: transfer.source.position.warehouseId,
            toWarehouseId: transfer.destination.position.warehouseId,
            date,
            quantity: round(transfer.quantity),
            reason:
              transfer.unitsRescued > 0
                ? `Rescues ${Math.round(transfer.unitsRescued)} units at risk of expiry at ${transfer.source.position.warehouseCode}`
                : `Covers a shortfall at ${transfer.destination.position.warehouseCode} inside its lead time`,
          });

          supplyPlans.push({
            planningRunId: runId,
            productId,
            warehouseId: transfer.destination.position.warehouseId,
            date: addDays(asOf, arrivalDay),
            quantity: round(transfer.quantity),
            source: "TRANSFER",
          });
        }
      }

      // Replenishment fires on the review cadence, not every day: quantity from the
      // order-up-to level, frequency from reviewPeriodDays. That is outcome 3.
      stage = "supply";
      for (const cell of cells) {
        const review = cell.parameters.reviewPeriodDays;
        if (review <= 0 || day % review !== 0) continue;

        const window = cell.forecast.slice(day, day + cell.leadTimeDays + review);
        const target = orderUpToLevel({
          avgDailyDemand: meanOf(window.map((point) => point.p50)),
          leadTimeDays: cell.leadTimeDays,
          reviewPeriodDays: review,
          safetyStock: cell.safetyStock,
        });

        const pipeline = [...cell.arrivals.entries()]
          .filter(([arrivalDay]) => arrivalDay > day)
          .reduce((total, [, quantity]) => total + quantity, 0);

        const floor = Math.max(1, cell.parameters.minimumOrderQty);
        let quantity = target - cell.onHand - pipeline;
        if (quantity < floor) continue;

        if (cell.maximumInventory !== null) {
          quantity = Math.min(quantity, Math.max(0, cell.maximumInventory - cell.onHand - pipeline));
        }
        if (quantity < floor) continue;

        const arrivalDay = Math.min(horizonDays, day + cell.leadTimeDays);
        addArrival(cell, arrivalDay, quantity);

        supplyPlans.push({
          planningRunId: runId,
          productId: cell.position.productId,
          warehouseId: cell.position.warehouseId,
          date: addDays(asOf, arrivalDay),
          quantity: round(quantity),
          source: "PLANNED_SUPPLY",
        });
      }
    }

    await writeInventoryPlans(inventoryPlans);
    await writeDrpPlans(drpPlans);
    await writeSupplyPlans(supplyPlans);

    stage = "optimization";
    await report("optimization");
    let holdingCost = 0;
    let stockoutCost = 0;
    let expiryCost = 0;
    let transferCost = 0;

    for (const cell of cells) {
      holdingCost += cell.holdingUnitDays * cell.parameters.holdingCostPerUnit;
      stockoutCost += cell.shortfallUnits * cell.parameters.stockoutCostPerUnit;

      const waste = Math.max(0, wasteUnitsOf(cell, inputs, horizonDays) - cell.wasteRescued);
      expiryCost += waste * cell.parameters.expiryCostPerUnit;
    }

    for (const plan of drpPlans) transferCost += plan.quantity * PLANNING.transferCostPerUnit;

    const totalCost = holdingCost + stockoutCost + transferCost + expiryCost;

    stage = "simulation";
    await report("simulation");
    const rng = createRng(PLANNING.simulationSeed);
    const iterations = PLANNING.simulationIterations;
    // Measured per cell-day, not once per iteration. A single flag across 160 series
    // and a whole horizon is set by any one of ~1,000 chances, so it was true in
    // essentially every iteration - pinning serviceLevel at 0 and both probabilities
    // at 1 for any network of a realistic size.
    let stockoutCellDays = 0;
    let cellDays = 0;
    let expiredCells = 0;
    let cellsSeen = 0;
    let unmetTotal = 0;
    let demandTotal = 0;
    let inventoryTotal = 0;
    let wasteTotal = 0;
    let costTotal = 0;

    for (let iteration = 0; iteration < iterations; iteration += 1) {
      let inventory = 0;
      let waste = 0;
      let cost = 0;

      for (const cell of cells) {
        let onHand = Math.max(0, cell.position.onHand - cell.position.reserved);

        for (const point of cell.forecast) {
          const stdDev = stdDevFromBand(point.p10, point.p90);
          // Box-Muller off the seeded stream, so the whole run is reproducible.
          const u1 = Math.max(Number.EPSILON, rng());
          const u2 = rng();
          const normal = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
          const demand = Math.max(0, point.p50 + normal * stdDev);

          // Fill rate: how much demand was met from stock, not whether a shortfall
          // happened somewhere. The unmet units are what a planner can act on.
          const shipped = Math.min(demand, onHand);
          unmetTotal += demand - shipped;
          demandTotal += demand;
          if (demand > onHand) stockoutCellDays += 1;
          cellDays += 1;

          onHand = Math.max(0, onHand - demand);
          inventory += onHand;
          cost += onHand * cell.parameters.holdingCostPerUnit;
        }

        cellsSeen += 1;
        if (cell.maximumInventory !== null && onHand > cell.maximumInventory) {
          expiredCells += 1;
          waste += onHand - cell.maximumInventory;
        }
      }

      inventoryTotal += inventory;
      wasteTotal += waste;
      costTotal += cost;

      // The only CPU-bound stage. Yielding keeps /api/health/ready answering, which
      // the container HEALTHCHECK polls every 30 seconds.
      if (iteration % 50 === 49) await new Promise((resolve) => setImmediate(resolve));
    }

    stage = "recommendations";
    await report("recommendations");
    const recommendations = buildRecommendations(runId, cells, drpPlans);

    stage = "complete";
    await report("complete");
    await completeRun({
      planningRunId: runId,
      modelVersion: run.modelVersion ?? forecast.modelVersion,
      optimization: {
        // The objective is to minimise total cost, so it is the total cost. Inventing
        // a second number would only invite the two to disagree.
        objectiveValue: round(totalCost),
        holdingCost: round(holdingCost),
        stockoutCost: round(stockoutCost),
        transferCost: round(transferCost),
        expiryCost: round(expiryCost),
        totalCost: round(totalCost),
        solver: "greedy-drp",
        solverStatus: "FEASIBLE",
      },
      simulation: {
        iterations,
        // Type-2 service (fill rate): the share of simulated demand met from stock.
        serviceLevel: round(demandTotal === 0 ? 1 : 1 - unmetTotal / demandTotal, 4),
        stockoutProbability: round(cellDays === 0 ? 0 : stockoutCellDays / cellDays, 4),
        expiryProbability: round(cellsSeen === 0 ? 0 : expiredCells / cellsSeen, 4),
        expectedInventory: round(inventoryTotal / iterations),
        expectedWaste: round(wasteTotal / iterations),
        expectedCost: round(costTotal / iterations),
      },
      recommendations,
    });

    return {
      executed: true,
      status: "COMPLETED",
      modelVersion: forecast.modelVersion,
      counts: {
        forecasts: forecastRows.length,
        inventoryPlans: inventoryPlans.length,
        drpPlans: drpPlans.length,
        supplyPlans: supplyPlans.length,
        recommendations: recommendations.length,
      },
    };
  } catch (error) {
    const failureStage = error instanceof PlanningExecutionError ? error.stage : stage;
    console.error("planning run failed", { runId, stage: failureStage, error });

    // Artefacts written before the failure are deliberately kept. A run is only real
    // once COMPLETED, so they are unreachable by contract, and they say where it got to.
    await prisma.planningRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        failureReason: failureReasonOf(error),
        failureStage,
        // The two describe the same moment, so they must not disagree.
        currentStage: failureStage,
      },
    });

    return { executed: true, status: "FAILED" };
  }
};
