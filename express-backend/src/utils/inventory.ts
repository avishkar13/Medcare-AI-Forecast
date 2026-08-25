import type { InventoryHealthState, RiskLevel } from "../types.js";

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

const SQRT_2PI = Math.sqrt(2 * Math.PI);

export const normalPdf = (z: number): number => Math.exp(-0.5 * z * z) / SQRT_2PI;

// Zelen & Severo (A&S 26.2.17), |error| < 7.5e-8. The inverse of zScore above.
export const normalCdf = (z: number): number => {
  const x = Math.abs(z);
  const t = 1 / (1 + 0.2316419 * x);
  const poly =
    ((((1.330274429 * t - 1.821255978) * t + 1.781477937) * t - 0.356563782) * t + 0.31938153) * t;
  const upperTail = normalPdf(x) * poly;
  return z >= 0 ? 1 - upperTail : upperTail;
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

// z(0.9) - z(0.1): the width of an 80% forecast band, in standard deviations.
const P10_P90_SPREAD = 2.5631031;

export const stdDevFromBand = (p10: number, p90: number): number =>
  Math.max(0, (p90 - p10) / P10_P90_SPREAD);

export interface OrderUpToInputs {
  avgDailyDemand: number;
  leadTimeDays: number;
  reviewPeriodDays: number;
  safetyStock: number;
}

// (R,S) policy: cover lead time plus one review period, then add the buffer.
export const orderUpToLevel = ({
  avgDailyDemand,
  leadTimeDays,
  reviewPeriodDays,
  safetyStock: buffer,
}: OrderUpToInputs): number =>
  Math.max(0, avgDailyDemand * (leadTimeDays + reviewPeriodDays) + buffer);

export interface ShortfallInputs {
  demandMean: number;
  demandStdDev: number;
  availableUnits: number;
}

// E[(demand - stock)+] under normal demand - the standard loss function.
export const expectedShortfall = ({
  demandMean,
  demandStdDev,
  availableUnits,
}: ShortfallInputs): number => {
  if (!(demandStdDev > 0)) return Math.max(0, demandMean - availableUnits);
  const k = (availableUnits - demandMean) / demandStdDev;
  return Math.max(0, demandStdDev * (normalPdf(k) - k * (1 - normalCdf(k))));
};

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

const EXPIRY_CRITICAL_DAYS = 15;
const EXPIRY_HIGH_DAYS = 30;
const EXPIRY_MEDIUM_DAYS = 60;

export const expirySeverity = (daysToExpiry: number): RiskLevel => {
  if (daysToExpiry <= EXPIRY_CRITICAL_DAYS) return "critical";
  if (daysToExpiry <= EXPIRY_HIGH_DAYS) return "high";
  if (daysToExpiry <= EXPIRY_MEDIUM_DAYS) return "medium";
  return "low";
};

const RISK_ORDER: Record<RiskLevel, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export interface RiskCondition {
  belowSafetyStock: boolean;
  belowReorderPoint: boolean;
  aboveMaximum: boolean;
  daysToNearestExpiry: number | null;
}

export const classifyRisk = ({
  belowSafetyStock,
  belowReorderPoint,
  aboveMaximum,
  daysToNearestExpiry,
}: RiskCondition): RiskLevel => {
  const candidates: RiskLevel[] = ["low"];

  if (belowSafetyStock) candidates.push("critical");
  else if (belowReorderPoint) candidates.push("high");

  if (aboveMaximum) candidates.push("medium");
  if (daysToNearestExpiry !== null) candidates.push(expirySeverity(daysToNearestExpiry));

  return candidates.reduce((worst, level) => (RISK_ORDER[level] < RISK_ORDER[worst] ? level : worst));
};

export interface SupplyPosition {
  avgDailyDemand: number;
  daysOfSupply: number;
}

// A position with no recorded demand reports daysOfSupply 0, which means "unknown",
// not "out tomorrow". Ordering by urgency has to push those to the back.
export const supplyUrgency = ({ avgDailyDemand, daysOfSupply }: SupplyPosition): number =>
  avgDailyDemand > 0 ? daysOfSupply : Number.POSITIVE_INFINITY;

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
