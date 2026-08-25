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
  dependencies: Record<"database" | "redis" | "forecast", DependencyStatus>;
}

export interface ResponseMeta {
  generatedAt: string;
  planningRunId?: string | null;
  page?: number;
  pageSize?: number;
  total?: number;
}

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

export type PlanningRunStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export interface ScenarioRef {
  id: string;
  name: string;
}

export interface ScenarioSummary {
  id: string;
  name: string;
  description: string | null;
  demandMultiplier: number;
  leadTimeMultiplier: number;
  capacityMultiplier: number;
  serviceLevelTarget: number;
  createdById: string;
  createdAt: string;
  planningRunCount: number;
}

export interface PlanningRunSummary {
  id: string;
  status: PlanningRunStatus;
  horizonDays: number;
  modelVersion: string | null;
  scenario: ScenarioRef | null;
  createdById: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  durationSeconds: number | null;
  stale: boolean;
  failureReason: string | null;
  failureStage: string | null;
}

export interface PlanningRunArtifacts {
  forecasts: number;
  inventoryPlans: number;
  supplyPlans: number;
  drpPlans: number;
  recommendations: number;
  optimization: boolean;
  simulation: boolean;
}

export interface PlanningRunDetail extends PlanningRunSummary {
  artifacts: PlanningRunArtifacts;
}

export interface PlanningRunCreation {
  run: PlanningRunSummary;
  replayed: boolean;
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

export type RiskLevel = "critical" | "high" | "medium" | "low";

export interface ExpiryRiskItem {
  batchId: string;
  batchNumber: string;
  productId: string;
  sku: string;
  productName: string;
  category: string | null;
  criticality: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  tier: string;
  quantity: number;
  unitCost: number;
  valueAtRisk: number;
  expiryDate: string;
  daysToExpiry: number;
  severity: RiskLevel;
  avgDailyDemand: number;
  projectedWaste: number;
  projectedWasteValue: number;
}

export interface ExpiryRiskTotals {
  batchCount: number;
  quantity: number;
  valueAtRisk: number;
  projectedWaste: number;
  projectedWasteValue: number;
}

export interface ExpiryRiskReport {
  items: ExpiryRiskItem[];
  totals: ExpiryRiskTotals;
}

export type PriorityActionType =
  | "TRANSFER_OPPORTUNITY"
  | "STOCKOUT_IMMINENT"
  | "BELOW_REORDER_POINT"
  | "EXPIRY_WRITE_OFF"
  | "EXCESS_STOCK";

export interface PriorityAction {
  id: string;
  type: PriorityActionType;
  severity: RiskLevel;
  sku: string;
  productName: string;
  criticality: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  tier: string;
  problem: string;
  recommendedAction: string;
  quantity: number | null;
  impactValue: number;
  sourceWarehouseCode: string | null;
  sourceWarehouseName: string | null;
}

export interface PriorityActionsReport {
  items: PriorityAction[];
  counts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
}

export type InventoryHealthState =
  | "criticalStock"
  | "belowReorderPoint"
  | "expiringSoon"
  | "excessStock"
  | "healthy";

export interface InventoryHealthBreakdown {
  criticalStock: number;
  belowReorderPoint: number;
  expiringSoon: number;
  excessStock: number;
  healthy: number;
  total: number;
}

export interface InventoryConditionCounts {
  belowSafetyStock: number;
  belowReorderPoint: number;
  aboveMaximum: number;
  expiringWithin30Days: number;
  expiringWithin90Days: number;
}

export interface CategoryHealth {
  category: string;
  skuCount: number;
  inventoryValue: number;
  atRiskCount: number;
  expiringValue: number;
}

export interface CriticalityHealth {
  criticality: string;
  skuCount: number;
  atRiskCount: number;
  stockoutRisk: number;
}

export interface InventoryHealthReport {
  breakdown: InventoryHealthBreakdown;
  conditions: InventoryConditionCounts;
  byCategory: CategoryHealth[];
  byCriticality: CriticalityHealth[];
}

export interface WarehouseStats {
  id: string;
  code: string;
  name: string;
  region: string | null;
  tier: string;
  capacity: number | null;
  skuCount: number;
  onHandUnits: number;
  utilization: number | null;
  inventoryValue: number;
  belowReorderPointCount: number;
  belowSafetyStockCount: number;
  stockoutRisk: number;
  shortageValue: number;
  excessValue: number;
  expiringValue: number;
}

export interface InventoryPositionItem {
  productId: string;
  sku: string;
  productName: string;
  category: string | null;
  criticality: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  tier: string;
  onHand: number;
  reserved: number;
  inTransit: number;
  available: number;
  safetyStock: number;
  reorderPoint: number;
  maximumInventory: number | null;
  avgDailyDemand: number;
  leadTimeDays: number;
  daysOfSupply: number;
  unitCost: number;
  inventoryValue: number;
  expiringUnits: number;
  expiringValue: number;
  daysToNearestExpiry: number | null;
  status: InventoryHealthState;
  risk: RiskLevel;
}

export interface InventoryTotals {
  positionCount: number;
  skuCount: number;
  warehouseCount: number;
  onHandUnits: number;
  inventoryValue: number;
  belowSafetyStockCount: number;
  belowReorderPointCount: number;
  aboveMaximumCount: number;
  expiringValue: number;
}

export interface InventoryListReport {
  items: InventoryPositionItem[];
  totals: InventoryTotals;
}

export interface StockBatchItem {
  batchId: string;
  batchNumber: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  quantity: number;
  unitCost: number;
  valueAtRisk: number;
  manufacturingDate: string | null;
  expiryDate: string;
  daysToExpiry: number;
  severity: RiskLevel;
}

export interface SkuInventoryDetail {
  product: ProductSummary;
  totals: InventoryTotals;
  positions: InventoryPositionItem[];
  batches: StockBatchItem[];
}

export interface TrainingRow {
  date: string;
  sku: string;
  productId: string;
  dc: string;
  warehouseId: string;
  demand: number;
  fulfilled: number | null;
  stockout: boolean;
  promotion: boolean;
  holiday: boolean;
  season: string | null;
  /** The warehouse's region — the key DemandSignal rows are grouped by. */
  region: string | null;
  /** Uplift factor from an overlapping PromotionEvent, or null if none. */
  promotionUplift: number | null;
  /** Type of the overlapping PromotionEvent (PROMOTION, SEASONAL, HOLIDAY, CAMPAIGN). */
  promotionType: string | null;
  /** Signal type of the most recent DemandSignal for this product on this date. */
  demandSignalType: string | null;
  /** Value of the most recent DemandSignal for this product on this date. */
  demandSignalValue: number | null;
}

/** A signal dated past the end of demand history, streamed after the history rows. */
export interface FutureSignalRow {
  _type: "future_signal";
  region: string | null;
  date: string;
  signalType: string;
  value: number;
}

/** A future scheduled promotion, streamed after demand-history rows. */
export interface FuturePromotionRow {
  _type: "future_promotion";
  productId: string | null;
  warehouseId: string | null;
  startDate: string;
  endDate: string;
  type: string;
  upliftFactor: number;
  name: string;
}

export interface ForecastPointBand {
  p10: number;
  p50: number;
  p90: number;
}

export interface ForecastSeriesResult {
  productId: string;
  warehouseId: string;
  points: ForecastPointBand[];
}

export interface ForecastResult {
  origin: "python" | "fallback";
  modelVersion: string;
  series: ForecastSeriesResult[];
}
