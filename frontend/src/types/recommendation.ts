export type RecommendationStatus = "Pending" | "Executed" | "Dismissed";
export type RecommendationPriority = "Critical" | "High" | "Medium" | "Low";
export type RecommendationActionType = "Replenish" | "Transfer" | "Reduce" | "Prioritize";

export interface RecommendationSignal {
  type: "Demand" | "Inventory" | "LeadTime" | "Expiry" | "Risk";
  label: string;
  direction: "up" | "down" | "flat";
}

export interface RecommendationItem {
  id: string;
  title: string;
  actionType: RecommendationActionType;
  priority: RecommendationPriority;
  confidence: number;
  reason: string;
  sku: string;
  location: string;
  fromLocation?: string; // For transfers
  toLocation?: string; // For transfers
  currentStock?: number;
  forecastDemand?: number;
  optimalStock?: number;
  recommendedQuantity: number;
  expectedImpact: string;
  impactValue: number; // Numeric value for sorting (e.g. savings in dollars)
  signals: RecommendationSignal[];
  status: RecommendationStatus;
  createdAt: string;
}

export interface RecommendationImpact {
  currentSupplyChainCost: number;
  aiOptimizedCost: number;
  projectedSavings: number;
  costReductionPercentage: number;
  categories: {
    stockout: number; // percentage of savings
    excessInventory: number; // percentage of savings
    expiry: number; // percentage of savings
    transfers: number; // percentage of savings
  };
}

export interface RecommendationIntelligence {
  signals: {
    demandForecast: number;
    inventoryPosition: number;
    leadTime: number;
    expiryRisk: number;
  };
  modelConfidence: number;
  explanation: string;
}
