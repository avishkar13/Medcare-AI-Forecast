import type { InventoryHealthState } from "../types.js";

const A = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
const B = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
const C = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
const D = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];

const LOW = 0.02425;

export const zScore = (probability: number): number => {
  const p = Math.min(Math.max(probability, 1e-6), 1 - 1e-6);

  if (p < LOW) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((C[0]! * q + C[1]!) * q + C[2]!) * q + C[3]!) * q + C[4]!) * q + C[5]!) /
      ((((D[0]! * q + D[1]!) * q + D[2]!) * q + D[3]!) * q + 1);
  }

  if (p > 1 - LOW) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((C[0]! * q + C[1]!) * q + C[2]!) * q + C[3]!) * q + C[4]!) * q + C[5]!) /
      ((((D[0]! * q + D[1]!) * q + D[2]!) * q + D[3]!) * q + 1);
  }

  const q = p - 0.5;
  const r = q * q;
  return ((((((A[0]! * r + A[1]!) * r + A[2]!) * r + A[3]!) * r + A[4]!) * r + A[5]!) * q) /
    (((((B[0]! * r + B[1]!) * r + B[2]!) * r + B[3]!) * r + B[4]!) * r + 1);
};

export interface DemandProfile {
  avgDailyDemand: number;
  demandStdDev: number;
  leadTimeDays: number;
  leadTimeStdDev: number;
  serviceLevel: number;
}

export const safetyStock = ({
  avgDailyDemand,
  demandStdDev,
  leadTimeDays,
  leadTimeStdDev,
  serviceLevel,
}: DemandProfile): number => {
  const leadTimeDemandVariance =
    leadTimeDays * demandStdDev ** 2 + avgDailyDemand ** 2 * leadTimeStdDev ** 2;
  return Math.max(0, zScore(serviceLevel) * Math.sqrt(leadTimeDemandVariance));
};

export const reorderPoint = (profile: DemandProfile): number =>
  profile.avgDailyDemand * profile.leadTimeDays + safetyStock(profile);

export interface FefoBatch {
  quantity: number;
  daysToExpiry: number;
}

export const projectFefoWaste = (batches: FefoBatch[], avgDailyDemand: number): number[] => {
  let quantityAhead = 0;

  return batches.map((batch) => {
    const consumableByExpiry = avgDailyDemand * Math.max(0, batch.daysToExpiry);
    const waste = Math.min(
      batch.quantity,
      Math.max(0, quantityAhead + batch.quantity - consumableByExpiry),
    );
    quantityAhead += batch.quantity;
    return waste;
  });
};

export const round = (value: number, decimals = 2): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

export const percentage = (part: number, whole: number): number =>
  whole <= 0 ? 0 : round((part / whole) * 100);

export interface StockCondition {
  belowSafetyStock: boolean;
  belowReorderPoint: boolean;
  expiringSoon: boolean;
  aboveMaximum: boolean;
}

export const classifyStock = (condition: StockCondition): InventoryHealthState => {
  if (condition.belowSafetyStock) return "criticalStock";
  if (condition.belowReorderPoint) return "belowReorderPoint";
  if (condition.expiringSoon) return "expiringSoon";
  if (condition.aboveMaximum) return "excessStock";
  return "healthy";
};

export interface TransferSource {
  available: number;
  wasteRemaining: number;
}

export interface TransferMatch {
  sourceIndex: number;
  quantity: number;
  unitsRescued: number;
}

export const allocateTransfers = (
  needs: number[],
  sources: TransferSource[],
  minimumUnits = 1,
): (TransferMatch | null)[] => {
  const pool = sources.map((source) => ({ ...source }));

  return needs.map((need) => {
    const sourceIndex = pool.findIndex((candidate) => candidate.available > 0);
    if (sourceIndex === -1) return null;

    const source = pool[sourceIndex]!;
    const quantity = Math.round(Math.min(need, source.available));
    if (quantity < minimumUnits) return null;

    const unitsRescued = Math.min(quantity, source.wasteRemaining);
    source.available -= quantity;
    source.wasteRemaining -= unitsRescued;

    return { sourceIndex, quantity, unitsRescued };
  });
};
