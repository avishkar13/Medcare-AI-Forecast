import type { RunComparison, RunOptimization, RunSimulation } from "@/lib/api/planning";
import type { WhatIfParams } from "@/lib/api/simulation";
import type {
  MetricDirection,
  SimulationMetric,
  SimulationOutput,
  SimulationParams,
} from "@/types/simulation";

/**
 * the ui has six sliders, the backend takes four multipliers. two have no
 * equivalent and are dropped rather than guessed at:
 *
 *   inventoryAvailability - the executor plans from the real inventory position
 *   transportationCost    - there is no per-lane cost model, only a flat rate
 *
 * supplierLeadTime is a days delta while the backend wants a percent, and a percent
 * needs a base. it converts against a nominal 10 day lead time, close to the
 * seeded average.
 */
const NOMINAL_LEAD_TIME_DAYS = 10;

export const toWhatIfParams = (params: SimulationParams): WhatIfParams => ({
  demandShockPercent: params.demandShock,
  leadTimeChangePercent: Math.round(
    (params.supplierLeadTime / NOMINAL_LEAD_TIME_DAYS) * 100,
  ),
  capacityChangePercent: params.distributionCapacity - 100,
  serviceLevelTargetPercent: params.serviceLevelTarget,
});

const round1 = (value: number) => Number(value.toFixed(1));

// for a cost, down is good; for service level, up is good
const direction = (delta: number, lowerIsBetter: boolean): MetricDirection => {
  if (delta === 0) return "neutral";
  const good = lowerIsBetter ? delta < 0 : delta > 0;
  return good ? "positive" : "negative";
};

const metric = (
  label: string,
  current: number,
  simulated: number,
  unit: string,
  format: SimulationMetric["format"],
  lowerIsBetter: boolean,
): SimulationMetric => ({
  label,
  currentValue: current,
  simulatedValue: simulated,
  delta: round1(simulated - current),
  unit,
  direction: direction(simulated - current, lowerIsBetter),
  format,
});

const risk = (probability: number): "low" | "moderate" | "high" | "critical" =>
  probability >= 0.5
    ? "critical"
    : probability >= 0.25
      ? "high"
      : probability >= 0.1
        ? "moderate"
        : "low";

/**
 * builds what the page renders from a completed run.
 *
 * without a baseline there is nothing to compare against, so current and simulated
 * are the same figure and every delta is zero. with one, the comparison supplies
 * both sides.
 *
 * dcImpacts, skuImpacts and risks stay empty: the backend exposes no per-dc or
 * per-sku breakdown of a simulation, and an empty state is better than a made-up one.
 */
export const toSimulationOutput = (
  simulation: RunSimulation | null,
  optimization: RunOptimization | null,
  comparison: RunComparison | null,
): SimulationOutput | null => {
  if (!simulation || !optimization) return null;

  const cost = comparison?.cost;
  const risks = comparison?.risk;

  const serviceNow = risks ? risks.serviceLevel.baseline * 100 : simulation.serviceLevel * 100;
  const stockoutNow = risks
    ? risks.stockoutProbability.baseline * 100
    : simulation.stockoutProbability * 100;
  const wasteNow = risks ? risks.expectedWaste.baseline : simulation.expectedWaste;
  const costNow = cost ? cost.total.baseline : optimization.totalCost;

  return {
    metrics: [
      metric("Service Level", round1(serviceNow), round1(simulation.serviceLevel * 100), "%", "percent", false),
      metric("Stockout Risk", round1(stockoutNow), round1(simulation.stockoutProbability * 100), "%", "percent", true),
      metric("Expected Waste", Math.round(wasteNow), Math.round(simulation.expectedWaste), "units", "number", true),
      metric("Total Cost", Math.round(costNow), Math.round(optimization.totalCost), "$", "currency", true),
    ],
    dcImpacts: [],
    skuImpacts: [],
    risks: [],
    financial: {
      currentCost: Math.round(costNow),
      simulatedCost: Math.round(optimization.totalCost),
      additionalCost: Math.round(optimization.totalCost - costNow),
      currentBreakdown: {
        inventoryHolding: Math.round(cost ? cost.holding.baseline : optimization.holdingCost),
        stockoutPenalties: Math.round(cost ? cost.stockout.baseline : optimization.stockoutCost),
        expeditedFreight: Math.round(cost ? cost.transfer.baseline : optimization.transferCost),
        expiryWaste: Math.round(cost ? cost.expiry.baseline : optimization.expiryCost),
      },
      simulatedBreakdown: {
        inventoryHolding: Math.round(optimization.holdingCost),
        stockoutPenalties: Math.round(optimization.stockoutCost),
        expeditedFreight: Math.round(optimization.transferCost),
        expiryWaste: Math.round(optimization.expiryCost),
      },
    },
    aiInsight: {
      overallRisk: risk(simulation.stockoutProbability),
      confidence: 0,
      insights: [
        `${(simulation.serviceLevel * 100).toFixed(1)}% of simulated demand met from stock over ${simulation.iterations} iterations.`,
        `${Math.round(simulation.expectedWaste)} units of expected waste, ${Math.round(optimization.expiryCost)} of it as expiry cost.`,
        ...(comparison ? comparison.warnings : ["No baseline run to compare against."]),
      ],
      suggestedResponse: "",
    },
    summary: "",
  };
};
