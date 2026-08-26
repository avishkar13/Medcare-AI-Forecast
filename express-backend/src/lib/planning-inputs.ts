import { prisma } from "../config/prisma.js";
import {
  loadExpiringBatches,
  loadPositions,
  type ExpiringBatch,
  type InventoryPosition,
} from "../services/dashboard.service.js";
import type { ForecastPair } from "../zod/forecast.schemas.js";

const EXPIRY_HORIZON_DAYS = 90;

export interface PlanningParameters {
  leadTimeDays: number;
  leadTimeStdDev: number;
  serviceLevel: number;
  reviewPeriodDays: number;
  minimumOrderQty: number;
  maximumInventory: number | null;
  holdingCostPerUnit: number;
  stockoutCostPerUnit: number;
  expiryCostPerUnit: number;
}

export interface ScenarioSettings {
  id: string;
  name: string;
  demandMultiplier: number;
  leadTimeMultiplier: number;
  capacityMultiplier: number;
  /**
   * An override, not a default. `null` means "use each pair's own
   * `PlanningParameter.serviceLevel`" - which is the point of storing it per pair.
   */
  serviceLevelTarget: number | null;
}

export interface PlanningInputs {
  positions: InventoryPosition[];
  pairs: ForecastPair[];
  parameters: Map<string, PlanningParameters>;
  batches: Map<string, ExpiringBatch[]>;
  scenario: ScenarioSettings | null;
}

export const pairKey = (productId: string, warehouseId: string) => `${productId}:${warehouseId}`;

// The scenario a run has no row for. Multipliers of 1 leave every figure untouched,
// so the baseline needs no branching anywhere downstream.
export const NEUTRAL_SCENARIO: ScenarioSettings = {
  id: "baseline",
  name: "Baseline",
  demandMultiplier: 1,
  leadTimeMultiplier: 1,
  capacityMultiplier: 1,
  // No scenario means no override: every pair keeps its own configured target.
  serviceLevelTarget: null,
};

/**
 * Everything a planning run reads, in one shot.
 *
 * Demand history is deliberately absent: the forecasting service pulls its own from
 * `/api/training-data`, and the naive fallback loads what it needs inside
 * `forecast.service.ts`. Loading 28,800 rows here to hand to neither would be waste.
 */
export const loadPlanningInputs = async (scenarioId: string | null): Promise<PlanningInputs> => {
  const [positions, expiring, parameterRows, scenarioRow] = await Promise.all([
    loadPositions(),
    loadExpiringBatches(EXPIRY_HORIZON_DAYS),
    prisma.planningParameter.findMany(),
    scenarioId === null
      ? Promise.resolve(null)
      : prisma.scenario.findUnique({ where: { id: scenarioId } }),
  ]);

  const parameters = new Map<string, PlanningParameters>(
    parameterRows.map((row) => [
      pairKey(row.productId, row.warehouseId),
      {
        leadTimeDays: row.leadTimeDays,
        leadTimeStdDev: row.leadTimeStdDev,
        serviceLevel: row.serviceLevel,
        reviewPeriodDays: row.reviewPeriodDays,
        minimumOrderQty: row.minimumOrderQty,
        maximumInventory: row.maximumInventory,
        holdingCostPerUnit: row.holdingCostPerUnit,
        stockoutCostPerUnit: row.stockoutCostPerUnit,
        expiryCostPerUnit: row.expiryCostPerUnit,
      },
    ]),
  );

  const batches = new Map<string, ExpiringBatch[]>();
  for (const batch of expiring) {
    const key = pairKey(batch.productId, batch.warehouseId);
    const bucket = batches.get(key);
    if (bucket) bucket.push(batch);
    else batches.set(key, [batch]);
  }

  // FEFO order, so every consumer walks batches soonest-expiring first.
  for (const bucket of batches.values()) bucket.sort((left, right) => left.daysToExpiry - right.daysToExpiry);

  return {
    positions,
    // Only pairs that hold a position get planned. /api/training-data exports every
    // pair with history, which is not the same set.
    pairs: positions.map((position) => ({
      productId: position.productId,
      warehouseId: position.warehouseId,
    })),
    parameters,
    batches,
    scenario: scenarioRow
      ? {
          id: scenarioRow.id,
          name: scenarioRow.name,
          demandMultiplier: scenarioRow.demandMultiplier,
          leadTimeMultiplier: scenarioRow.leadTimeMultiplier,
          capacityMultiplier: scenarioRow.capacityMultiplier,
          serviceLevelTarget: scenarioRow.serviceLevelTarget,
        }
      : null,
  };
};

export const settingsOf = (inputs: PlanningInputs): ScenarioSettings =>
  inputs.scenario ?? NEUTRAL_SCENARIO;
