export type InventoryStatus = "healthy" | "low" | "critical";
export type AlertSeverity = "info" | "warning" | "critical";
export type RecommendationAction = "order" | "transfer" | "discard";

export interface InventoryItem {
  id: string; // SKU
  name: string;
  category: string;
  currentStock: number;
  minimumStock: number;
  maximumStock: number;
  unitCost: number;
  status: InventoryStatus;
  leadTimeDays: number;
  expiryDate?: string; // ISO date string
}

export interface ForecastPoint {
  date: string; // ISO date string
  actualDemand?: number; // Present for historical data
  predictedDemand?: number; // Present for future data
  lowerBound?: number;
  upperBound?: number;
}

export interface Alert {
  id: string;
  itemId: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  timestamp: string; // ISO date string
  isRead: boolean;
}

export interface ReplenishmentRecommendation {
  id: string;
  itemId: string;
  action: RecommendationAction;
  sourceDc?: string;
  destinationDc?: string;
  currentInventory: number;
  forecastDemand: number;
  riskStatus: "critical" | "high" | "medium" | "low";
  suggestedQuantity: number;
  confidenceScore: number; // 0-100
  estimatedDeliveryDate: string; // ISO date string
  reason: string;
  expectedImpact: string;
  priority: "critical" | "high" | "medium" | "low";
}

export interface DashboardKPIs {
  totalInventoryValue: number;
  skusMonitored: number;
  stockoutRiskItems: number;
  expiryRiskItems: number;
  onTimeDeliveryRate: number; // percentage
  forecastAccuracy: number; // percentage
  activeAlerts: number;
  pendingRecommendations: number;
}

export interface NetworkHealth {
  overallScore: number;
  inStockPercentage: number;
  atRiskSkuCount: number;
  excessInventoryValue: number;
  shortageValue: number;
}

export interface PriorityAction {
  id: string;
  sku: string;
  dc: string;
  problem: string;
  severity: "critical" | "warning" | "info";
  recommendedAction: string;
}

export interface SimulationResult {
  scenarioId: string;
  scenarioName: string;
  projectedStockoutRisk: number; // percentage
  estimatedCostSavings: number;
  impactScore: number; // 0-100
}

export interface ExpiryRiskItem {
  id: string;
  sku: string;
  name: string;
  batchId: string;
  currentQuantity: number;
  daysToExpiry: number;
  inventoryValue: number;
  dc: string;
  severity: "critical" | "high" | "medium" | "low";
}

export interface DistributionCenterStats {
  id: string;
  name: string;
  capacity: number; // Max units or volume
  utilization: number; // Percentage
  inventoryValue: number;
  atRiskInventory: number;
  stockoutRisk: number; // Percentage
}

export interface OptimizationMetrics {
  current: {
    holdingCost: number;
    stockoutPenalty: number;
    expiryCost: number;
    transferCost: number;
    totalCost: number;
  };
  optimized: {
    holdingCost: number;
    stockoutPenalty: number;
    expiryCost: number;
    transferCost: number;
    totalCost: number;
  };
  savings: number;
  savingsPercentage: number;
}
