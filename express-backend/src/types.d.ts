import type { Request as ExpressRequest } from "express";
import type { RateLimitInfo } from "express-rate-limit";

declare global {
  namespace Express {
    interface AuthenticatedUser {
      id: string;
      roles?: string[];
    }

    interface Request {
      id: string;
      user?: AuthenticatedUser;
      rateLimit?: RateLimitInfo;
    }
  }
}

export type ErrorDetails = Record<string, unknown> | unknown[];

export interface AppErrorOptions {
  details?: ErrorDetails;
  cause?: unknown;
}

export interface NormalizedError {
  statusCode: number;
  code: string;
  message: string;
  details?: ErrorDetails;
}

export interface RateLimitRule {
  name: string;
  windowMs: number;
  limit: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  skip?: (req: ExpressRequest) => boolean;
}

export type RateLimitStoreKind = "redis" | "memory" | "disabled";

export type DependencyStatus = "up" | "down" | "not_configured";

export interface ReadinessReport {
  status: "ok" | "degraded";
  uptimeSeconds: number;
  dependencies: Record<"database" | "redis", DependencyStatus>;
}

export interface ResponseMeta {
  generatedAt: string;
  planningRunId?: string | null;
  page?: number;
  pageSize?: number;
  total?: number;
}

export type RiskLevel = "critical" | "high" | "medium" | "low";
export type RiskLevelOrNone = RiskLevel | "none";
export type InventoryDetailStatus = "healthy" | "reorder_required" | "overstocked" | "at_risk" | "expiring";

export interface ProductSummary {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  unit: string;
  unitCost: number;
  shelfLifeDays: number | null;
  criticality: string;
  isActive: boolean;
}

export interface WarehouseSummary {
  id: string;
  code: string;
  name: string;
  region: string | null;
  tier: string;
  location: string | null;
  capacity: number | null;
  isActive: boolean;
}

export interface DashboardKPIs {
  totalInventoryValue: number;
  skusMonitored: number;
  stockoutRiskItems: number;
  expiryRiskItems: number;
  onTimeDeliveryRate: number | null;
  forecastAccuracy: number | null;
  activeAlerts: number;
  pendingRecommendations: number;
}

export interface NetworkHealthSummary {
  overallScore: number;
  inStockPercentage: number;
  atRiskSkuCount: number;
  excessInventoryValue: number;
  shortageValue: number;
}

export interface DistributionCenterStats {
  id: string;
  name: string;
  capacity: number;
  utilization: number;
  inventoryValue: number;
  atRiskInventory: number;
  stockoutRisk: number;
}

export interface InventoryHealthBreakdown {
  healthy: number;
  belowReorderPoint: number;
  criticalStock: number;
  excessStock: number;
  expiringSoon: number;
  total: number;
}

export interface InventoryTableItem {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  location: string;
  onHand: number;
  safetyStock: number;
  reorderPoint: number;
  daysOfSupply: number;
  unitValue: number;
  inventoryValue: number;
  risk: RiskLevel;
  status: InventoryDetailStatus;
}

export interface InventoryHealthReport {
  breakdown: InventoryHealthBreakdown;
  byCategory: { category: string; value: number; count: number }[];
  topItems: InventoryTableItem[];
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
  severity: RiskLevel;
}

export interface PriorityAction {
  id: string;
  sku: string;
  dc: string;
  problem: string;
  severity: "critical" | "warning" | "info";
  recommendedAction: string;
}

export interface ForecastPoint {
  date: string;
  actualDemand?: number;
  predictedDemand?: number;
  lowerBound?: number;
  upperBound?: number;
}

export interface ReplenishmentRecommendation {
  id: string;
  itemId: string;
  action: "order" | "transfer" | "discard";
  sourceDc?: string;
  destinationDc?: string;
  currentInventory: number;
  forecastDemand: number;
  riskStatus: RiskLevel;
  suggestedQuantity: number;
  confidenceScore: number;
  estimatedDeliveryDate: string;
  reason: string;
  expectedImpact: string;
  priority: RiskLevel;
}

export interface OptimizationCostBreakdown {
  holdingCost: number;
  stockoutPenalty: number;
  expiryCost: number;
  transferCost: number;
  totalCost: number;
}

export interface OptimizationMetrics {
  current: OptimizationCostBreakdown;
  optimized: OptimizationCostBreakdown;
  savings: number;
  savingsPercentage: number;
}

export interface SimulationResult {
  scenarioId: string;
  scenarioName: string;
  projectedStockoutRisk: number;
  estimatedCostSavings: number;
  impactScore: number;
}

export interface WhatIfResult {
  currentStockoutRisk: number;
  projectedStockoutRisk: number;
  currentCost: number;
  projectedCost: number;
  estimatedCostSavings: number;
  impactScore: number;
}

export interface EngineStatusReport {
  forecast: DependencyStatus;
  inventory: DependencyStatus;
  optimization: DependencyStatus;
  simulation: DependencyStatus;
  lastRunId: string | null;
  lastRunStatus: string | null;
  lastRunCompletedAt: string | null;
}
