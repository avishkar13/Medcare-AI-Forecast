import {
  SimulationParams,
  SimulationMetric,
  DCImpact,
  SKUInventoryImpact,
  RiskIndicator,
  FinancialImpact,
  AIInsight,
  SimulationOutput,
  ScenarioPreset,
  MetricDirection,
} from "@/types/simulation";

// ─── Baseline Values ───────────────────────────────────────────────
const BASELINE = {
  stockoutRisk: 4.2,
  totalInventory: 1245000,
  supplyChainCost: 49300,
  serviceLevel: 96.5,
  expiryExposure: 1600,
  capacityUtilization: 88.5,
};

const DC_BASELINE: Omit<DCImpact, "simulatedCapacity" | "simulatedStockoutRisk" | "simulatedAtRiskValue">[] = [
  { name: "Northeast DC", currentCapacity: 88.5, currentStockoutRisk: 4.2, currentAtRiskValue: 13000 },
  { name: "South DC", currentCapacity: 72.3, currentStockoutRisk: 3.1, currentAtRiskValue: 8500 },
  { name: "West Coast DC", currentCapacity: 91.0, currentStockoutRisk: 5.8, currentAtRiskValue: 18000 },
  { name: "Midwest DC", currentCapacity: 65.4, currentStockoutRisk: 2.5, currentAtRiskValue: 6200 },
];

const SKU_BASELINE: Omit<SKUInventoryImpact, "simulatedInventory">[] = [
  { name: "Amoxicillin 500mg", sku: "SKU-AMX-500", currentInventory: 12500, optimalInventory: 14000 },
  { name: "Ibuprofen 400mg", sku: "SKU-IBU-400", currentInventory: 8200, optimalInventory: 9000 },
  { name: "Lisinopril 10mg", sku: "SKU-LIS-10", currentInventory: 3100, optimalInventory: 7500 },
  { name: "Metformin 500mg", sku: "SKU-MET-500", currentInventory: 15800, optimalInventory: 13000 },
  { name: "Omeprazole 20mg", sku: "SKU-OME-20", currentInventory: 6400, optimalInventory: 8000 },
];

// ─── Preset Configs ────────────────────────────────────────────────
export const SCENARIO_PRESETS: Record<ScenarioPreset, { label: string; description: string; params: SimulationParams }> = {
  baseline: {
    label: "Baseline",
    description: "Current network state with no modifications",
    params: { demandShock: 0, inventoryAvailability: 100, serviceLevelTarget: 95, supplierLeadTime: 0, distributionCapacity: 100, transportationCost: 0 },
  },
  "demand-surge": {
    label: "Demand Surge",
    description: "Simulate a sudden increase in product demand",
    params: { demandShock: 40, inventoryAvailability: 100, serviceLevelTarget: 95, supplierLeadTime: 5, distributionCapacity: 100, transportationCost: 10 },
  },
  "supplier-delay": {
    label: "Supplier Delay",
    description: "Model extended supplier lead times",
    params: { demandShock: 0, inventoryAvailability: 85, serviceLevelTarget: 95, supplierLeadTime: 10, distributionCapacity: 100, transportationCost: 25 },
  },
  "inventory-shortage": {
    label: "Inventory Shortage",
    description: "Stress-test with reduced inventory levels",
    params: { demandShock: 15, inventoryAvailability: 65, serviceLevelTarget: 90, supplierLeadTime: 3, distributionCapacity: 100, transportationCost: 0 },
  },
  overstock: {
    label: "Overstock",
    description: "Evaluate excess inventory scenarios",
    params: { demandShock: -20, inventoryAvailability: 115, serviceLevelTarget: 95, supplierLeadTime: 0, distributionCapacity: 100, transportationCost: -10 },
  },
  "combined-stress": {
    label: "Combined Stress",
    description: "Multiple adverse conditions simultaneously",
    params: { demandShock: 50, inventoryAvailability: 70, serviceLevelTarget: 90, supplierLeadTime: 10, distributionCapacity: 80, transportationCost: 50 },
  },
};

// ─── Helpers ───────────────────────────────────────────────────────
function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function direction(delta: number, higherIsBetter: boolean): MetricDirection {
  if (Math.abs(delta) < 0.5) return "neutral";
  return (delta > 0) === higherIsBetter ? "positive" : "negative";
}

// ─── Main Calculations ────────────────────────────────────────────
export function calculateSimulationMetrics(params: SimulationParams): SimulationMetric[] {
  const demandFactor = 1 + params.demandShock / 100;
  const invFactor = params.inventoryAvailability / 100;
  const leadFactor = 1 + params.supplierLeadTime / 10;
  const capFactor = params.distributionCapacity / 100;
  const transFactor = 1 + params.transportationCost / 100;

  const simStockout = clamp(BASELINE.stockoutRisk * demandFactor * leadFactor / invFactor / capFactor, 0.5, 45);
  const simInventory = BASELINE.totalInventory * invFactor * (1 + params.demandShock * 0.001);
  const simCost = BASELINE.supplyChainCost * demandFactor * leadFactor * transFactor * (2 - invFactor * 0.5) / capFactor;
  const simService = clamp(BASELINE.serviceLevel / demandFactor / leadFactor * invFactor * capFactor, 65, 99.5);
  const simExpiry = BASELINE.expiryExposure * (invFactor > 1 ? invFactor * 1.5 : 1) * (demandFactor < 1 ? 1 / demandFactor : 1) * leadFactor;
  const simCapacity = clamp(BASELINE.capacityUtilization * demandFactor / capFactor, 40, 130);

  return [
    {
      label: "Stockout Risk",
      currentValue: BASELINE.stockoutRisk,
      simulatedValue: Math.round(simStockout * 10) / 10,
      delta: Math.round((simStockout - BASELINE.stockoutRisk) * 10) / 10,
      unit: "%",
      direction: direction(simStockout - BASELINE.stockoutRisk, false),
      format: "percent",
    },
    {
      label: "Total Inventory",
      currentValue: BASELINE.totalInventory,
      simulatedValue: Math.round(simInventory),
      delta: Math.round(simInventory - BASELINE.totalInventory),
      unit: "$",
      direction: direction(simInventory - BASELINE.totalInventory, false),
      format: "currency",
    },
    {
      label: "Supply Chain Cost",
      currentValue: BASELINE.supplyChainCost,
      simulatedValue: Math.round(simCost),
      delta: Math.round(simCost - BASELINE.supplyChainCost),
      unit: "$",
      direction: direction(simCost - BASELINE.supplyChainCost, false),
      format: "currency",
    },
    {
      label: "Service Level",
      currentValue: BASELINE.serviceLevel,
      simulatedValue: Math.round(simService * 10) / 10,
      delta: Math.round((simService - BASELINE.serviceLevel) * 10) / 10,
      unit: "%",
      direction: direction(simService - BASELINE.serviceLevel, true),
      format: "percent",
    },
    {
      label: "Expiry Exposure",
      currentValue: BASELINE.expiryExposure,
      simulatedValue: Math.round(simExpiry),
      delta: Math.round(simExpiry - BASELINE.expiryExposure),
      unit: "$",
      direction: direction(simExpiry - BASELINE.expiryExposure, false),
      format: "currency",
    },
    {
      label: "Capacity Utilization",
      currentValue: BASELINE.capacityUtilization,
      simulatedValue: Math.round(simCapacity * 10) / 10,
      delta: Math.round((simCapacity - BASELINE.capacityUtilization) * 10) / 10,
      unit: "%",
      direction: direction(simCapacity - BASELINE.capacityUtilization, false),
      format: "percent",
    },
  ];
}

export function calculateDCImpacts(params: SimulationParams): DCImpact[] {
  const demandFactor = 1 + params.demandShock / 100;
  const invFactor = params.inventoryAvailability / 100;
  const capFactor = params.distributionCapacity / 100;
  const leadFactor = 1 + params.supplierLeadTime / 10;

  return DC_BASELINE.map((dc) => ({
    ...dc,
    simulatedCapacity: clamp(Math.round(dc.currentCapacity * demandFactor / capFactor * 10) / 10, 30, 130),
    simulatedStockoutRisk: clamp(Math.round(dc.currentStockoutRisk * demandFactor * leadFactor / invFactor * 10) / 10, 0.5, 40),
    simulatedAtRiskValue: Math.round(dc.currentAtRiskValue * demandFactor * leadFactor / invFactor),
  }));
}

export function calculateSKUImpacts(params: SimulationParams): SKUInventoryImpact[] {
  const invFactor = params.inventoryAvailability / 100;
  const demandFactor = 1 + params.demandShock / 100;

  return SKU_BASELINE.map((sku) => ({
    ...sku,
    simulatedInventory: Math.round(sku.currentInventory * invFactor / demandFactor),
  }));
}

export function calculateRiskAnalysis(params: SimulationParams): RiskIndicator[] {
  const metrics = calculateSimulationMetrics(params);
  const stockout = metrics[0];
  const expiry = metrics[4];
  const capacity = metrics[5];
  const cost = metrics[2];

  function severity(delta: number, thresholds: number[]): "low" | "moderate" | "high" | "critical" {
    const abs = Math.abs(delta);
    if (abs < thresholds[0]) return "low";
    if (abs < thresholds[1]) return "moderate";
    if (abs < thresholds[2]) return "high";
    return "critical";
  }

  return [
    {
      name: "Stockout Risk",
      icon: "AlertTriangle",
      currentValue: stockout.currentValue,
      simulatedValue: stockout.simulatedValue,
      delta: stockout.delta,
      severity: severity(stockout.delta, [3, 8, 15]),
    },
    {
      name: "Expiry Risk",
      icon: "Clock",
      currentValue: expiry.currentValue,
      simulatedValue: expiry.simulatedValue,
      delta: Math.round((expiry.simulatedValue - expiry.currentValue) / expiry.currentValue * 100),
      severity: severity((expiry.simulatedValue - expiry.currentValue) / expiry.currentValue * 100, [20, 50, 100]),
    },
    {
      name: "Capacity Risk",
      icon: "Server",
      currentValue: capacity.currentValue,
      simulatedValue: capacity.simulatedValue,
      delta: capacity.delta,
      severity: capacity.simulatedValue > 100 ? "critical" : severity(capacity.delta, [5, 10, 20]),
    },
    {
      name: "Cost Risk",
      icon: "DollarSign",
      currentValue: cost.currentValue,
      simulatedValue: cost.simulatedValue,
      delta: Math.round((cost.simulatedValue - cost.currentValue) / cost.currentValue * 100),
      severity: severity((cost.simulatedValue - cost.currentValue) / cost.currentValue * 100, [10, 30, 60]),
    },
  ];
}

export function calculateFinancialImpact(params: SimulationParams): FinancialImpact {
  const demandFactor = 1 + params.demandShock / 100;
  const invFactor = params.inventoryAvailability / 100;
  const leadFactor = 1 + params.supplierLeadTime / 10;
  const transFactor = 1 + params.transportationCost / 100;

  const currentBreakdown = {
    inventoryHolding: 18500,
    stockoutPenalties: 8200,
    expeditedFreight: 12400,
    expiryWaste: 10200,
  };

  const simulatedBreakdown = {
    inventoryHolding: Math.round(currentBreakdown.inventoryHolding * invFactor * 1.1),
    stockoutPenalties: Math.round(currentBreakdown.stockoutPenalties * demandFactor * leadFactor / invFactor),
    expeditedFreight: Math.round(currentBreakdown.expeditedFreight * leadFactor * transFactor),
    expiryWaste: Math.round(currentBreakdown.expiryWaste * (invFactor > 1 ? invFactor * 1.3 : 1)),
  };

  const currentCost = Object.values(currentBreakdown).reduce((a, b) => a + b, 0);
  const simulatedCost = Object.values(simulatedBreakdown).reduce((a, b) => a + b, 0);

  return {
    currentCost,
    simulatedCost,
    additionalCost: simulatedCost - currentCost,
    currentBreakdown,
    simulatedBreakdown,
  };
}

export function generateAIInsight(params: SimulationParams, metrics: SimulationMetric[]): AIInsight {
  const stockout = metrics[0];
  const service = metrics[3];
  const capacity = metrics[5];

  // Determine overall risk
  let overallRisk: AIInsight["overallRisk"] = "low";
  if (stockout.simulatedValue > 15 || capacity.simulatedValue > 105) overallRisk = "critical";
  else if (stockout.simulatedValue > 10 || service.simulatedValue < 90) overallRisk = "high";
  else if (stockout.simulatedValue > 6 || service.simulatedValue < 93) overallRisk = "moderate";

  const confidence = clamp(Math.round(95 - Math.abs(params.demandShock) * 0.1 - Math.abs(params.supplierLeadTime) * 0.5), 75, 96);

  const insights: string[] = [];

  if (capacity.simulatedValue > 100) {
    insights.push(`Distribution centers exceed available capacity at ${capacity.simulatedValue}% utilization.`);
  }
  if (stockout.simulatedValue > 10) {
    insights.push("Stockout probability increases significantly for Lisinopril and Ibuprofen.");
  }
  if (params.supplierLeadTime > 5) {
    insights.push(`Extended lead time of +${params.supplierLeadTime} days will increase expedited freight costs.`);
  }
  if (params.demandShock > 30) {
    insights.push(`A ${params.demandShock}% demand surge requires immediate inventory repositioning.`);
  }
  if (service.simulatedValue < 90) {
    insights.push(`Service level drops to ${service.simulatedValue}%, below the target threshold.`);
  }
  if (params.inventoryAvailability < 80) {
    insights.push("Reduced inventory availability creates critical shortage risk across multiple SKUs.");
  }

  // Take top 3
  const topInsights = insights.slice(0, 3);
  if (topInsights.length === 0) {
    topInsights.push("Network remains stable under current scenario conditions.");
    topInsights.push("No immediate intervention is required.");
    topInsights.push("Continue monitoring demand patterns for early warning signals.");
  }

  let suggestedResponse = "No immediate action required. Monitor key metrics.";
  if (overallRisk === "critical") {
    suggestedResponse = "Replenish 5,000 units of SKU-LIS-10 and transfer 1,500 units of SKU-OME-20 before executing this scenario. Consider activating backup suppliers.";
  } else if (overallRisk === "high") {
    suggestedResponse = "Pre-position safety stock at Northeast DC and West Coast DC. Review expedited shipping options for critical SKUs.";
  } else if (overallRisk === "moderate") {
    suggestedResponse = "Increase safety stock levels by 15% for at-risk SKUs. Monitor supplier performance closely.";
  }

  return { overallRisk, confidence, insights: topInsights, suggestedResponse };
}

export function generateScenarioSummary(preset: ScenarioPreset, params: SimulationParams): string {
  const parts: string[] = [];

  if (params.demandShock > 0) parts.push(`a ${params.demandShock}% demand surge`);
  if (params.demandShock < 0) parts.push(`a ${Math.abs(params.demandShock)}% demand reduction`);
  if (params.supplierLeadTime > 0) parts.push(`+${params.supplierLeadTime} day supplier delays`);
  if (params.inventoryAvailability < 100) parts.push(`${100 - params.inventoryAvailability}% inventory reduction`);
  if (params.inventoryAvailability > 100) parts.push(`${params.inventoryAvailability - 100}% excess inventory`);
  if (params.distributionCapacity < 100) parts.push(`${100 - params.distributionCapacity}% capacity reduction`);
  if (params.transportationCost > 20) parts.push(`elevated transportation costs (+${params.transportationCost}%)`);

  if (parts.length === 0) return "Baseline scenario with no modifications. The network operates under current conditions.";

  const scenario = parts.join(", ");
  const presetLabel = SCENARIO_PRESETS[preset].label;

  return `${presetLabel} scenario simulates ${scenario}. The network may experience increased operational pressure unless proactive measures are taken.`;
}

// ─── Full Simulation Run ───────────────────────────────────────────
export function runSimulation(preset: ScenarioPreset, params: SimulationParams): SimulationOutput {
  const metrics = calculateSimulationMetrics(params);
  const dcImpacts = calculateDCImpacts(params);
  const skuImpacts = calculateSKUImpacts(params);
  const risks = calculateRiskAnalysis(params);
  const financial = calculateFinancialImpact(params);
  const aiInsight = generateAIInsight(params, metrics);
  const summary = generateScenarioSummary(preset, params);

  return { metrics, dcImpacts, skuImpacts, risks, financial, aiInsight, summary };
}
