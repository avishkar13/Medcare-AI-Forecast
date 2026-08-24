// ─── Scenario Presets ───────────────────────────────────────────────
export type ScenarioPreset =
  | "baseline"
  | "demand-surge"
  | "supplier-delay"
  | "inventory-shortage"
  | "overstock"
  | "combined-stress";

// ─── Simulation Parameters ─────────────────────────────────────────
export interface SimulationParams {
  demandShock: number;            // -50 to +100 (%)
  inventoryAvailability: number;  // 50 to 120 (%)
  serviceLevelTarget: number;     // 80 to 99 (%)
  supplierLeadTime: number;       // -5 to +14 (days delta)
  distributionCapacity: number;   // 50 to 120 (%)
  transportationCost: number;     // -20 to +100 (%)
}

export interface ParamConfig {
  key: keyof SimulationParams;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  baseline: number;
  tooltip: string;
  format: (v: number) => string;
}

// ─── Simulation Results ────────────────────────────────────────────
export type MetricDirection = "positive" | "negative" | "neutral";

export interface SimulationMetric {
  label: string;
  currentValue: number;
  simulatedValue: number;
  delta: number;
  unit: string;
  direction: MetricDirection;
  format: "percent" | "currency" | "number";
}

export interface DCImpact {
  name: string;
  currentCapacity: number;
  simulatedCapacity: number;
  currentStockoutRisk: number;
  simulatedStockoutRisk: number;
  currentAtRiskValue: number;
  simulatedAtRiskValue: number;
}

export interface SKUInventoryImpact {
  name: string;
  sku: string;
  currentInventory: number;
  simulatedInventory: number;
  optimalInventory: number;
}

export interface RiskIndicator {
  name: string;
  icon: string; // lucide icon name for rendering
  currentValue: number;
  simulatedValue: number;
  delta: number;
  severity: "low" | "moderate" | "high" | "critical";
}

export interface CostBreakdown {
  inventoryHolding: number;
  stockoutPenalties: number;
  expeditedFreight: number;
  expiryWaste: number;
}

export interface FinancialImpact {
  currentCost: number;
  simulatedCost: number;
  additionalCost: number;
  currentBreakdown: CostBreakdown;
  simulatedBreakdown: CostBreakdown;
}

export interface AIInsight {
  overallRisk: "low" | "moderate" | "high" | "critical";
  confidence: number;
  insights: string[];
  suggestedResponse: string;
}

export interface SimulationOutput {
  metrics: SimulationMetric[];
  dcImpacts: DCImpact[];
  skuImpacts: SKUInventoryImpact[];
  risks: RiskIndicator[];
  financial: FinancialImpact;
  aiInsight: AIInsight;
  summary: string;
}

// ─── Saved / History ───────────────────────────────────────────────
export interface SavedScenario {
  id: string;
  name: string;
  preset: ScenarioPreset;
  params: SimulationParams;
  metrics: SimulationMetric[];
  riskLevel: "low" | "moderate" | "high" | "critical";
  date: string;
}

export interface SimulationHistoryItem {
  id: string;
  scenario: string;
  preset: ScenarioPreset;
  date: string;
  keyChange: string;
  riskLevel: "low" | "moderate" | "high" | "critical";
  resultSummary: string;
  params: SimulationParams;
}
