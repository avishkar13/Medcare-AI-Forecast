export type ExpiryRiskLevel = "critical" | "high" | "medium" | "low";
export type ExpiryStatus = "prioritized" | "monitor" | "transfer" | "normal";

export interface ExpiryBatch {
  id: string;
  sku: string;
  productName: string;
  category: string;
  batchNumber: string;
  location: string;
  quantity: number;
  unitCost: number;
  expiryDate: string;
  daysRemaining: number;
  forecastDemand: number;
  demandCoverage: number;
  inventoryValue: number;
  riskLevel: ExpiryRiskLevel;
  wasteSharePercent: number;
  projectedWasteUnits: number;
  wasteValue: number;
  status: ExpiryStatus;
}

export interface DistributionCenterExpiry {
  location: string;
  atRiskValue: number;
  criticalBatches: number;
}

export interface WastePreventionRecord {
  id: string;
  productName: string;
  actionTaken: string;
  unitsSaved: number;
  valueSaved: number;
  date: string;
}

export interface ExpiryTimelineGroup {
  label: string;
  batches: number;
  value: number;
}

export interface ExpiryAnalysis {
  overallRisk: ExpiryRiskLevel;
  confidence: number;
  insights: string[];
  recommendedStrategy: string;
}
