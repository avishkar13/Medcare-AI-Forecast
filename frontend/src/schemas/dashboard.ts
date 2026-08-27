import { z } from "zod";
import { riskLevelSchema } from "./inventory";

/**
 * The dashboard boundary. Follows `schemas/alerts.ts`.
 *
 * Several fields the hand-written interfaces declared as required are nullable on the
 * wire, and the drift matters here more than anywhere: this is the KPI row, and a
 * `null` rendered as `0` is the difference between "not measured yet" and "zero".
 * `onTimeDeliveryRate` and `forecastAccuracy` are null until there is something to
 * measure - the backend refuses to invent a plausible number, and neither should the
 * client.
 */

export const dashboardKpisSchema = z.object({
  totalInventoryValue: z.number(),
  skusMonitored: z.number(),
  stockoutRiskItems: z.number(),
  expiryRiskItems: z.number(),
  onTimeDeliveryRate: z.number().nullable(),
  forecastAccuracy: z.number().nullable(),
  activeAlerts: z.number(),
  pendingRecommendations: z.number(),
});

export const networkHealthSchema = z.object({
  overallScore: z.number(),
  inStockPercentage: z.number(),
  atRiskSkuCount: z.number(),
  excessInventoryValue: z.number(),
  shortageValue: z.number(),
});

export const dashboardSummarySchema = z.object({
  kpis: dashboardKpisSchema,
  networkHealth: networkHealthSchema,
});

export const networkCenterSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  region: z.string().nullable(),
  tier: z.string(),
  // Null when the warehouse has no capacity on file, which makes utilization null too.
  capacity: z.number().nullable(),
  skuCount: z.number(),
  onHandUnits: z.number(),
  utilization: z.number().nullable(),
  inventoryValue: z.number(),
  belowReorderPointCount: z.number(),
  belowSafetyStockCount: z.number(),
  stockoutRisk: z.number(),
  shortageValue: z.number(),
  excessValue: z.number(),
  expiringValue: z.number(),
});

export const priorityActionSchema = z.object({
  id: z.string(),
  type: z.string(),
  severity: riskLevelSchema,
  sku: z.string(),
  productName: z.string(),
  criticality: z.string(),
  // The id, not just the code. Without it a link out of this row cannot carry the DC.
  warehouseId: z.string(),
  warehouseCode: z.string(),
  warehouseName: z.string(),
  tier: z.string(),
  problem: z.string(),
  recommendedAction: z.string(),
  quantity: z.number().nullable(),
  impactValue: z.number(),
  sourceWarehouseCode: z.string().nullable(),
  sourceWarehouseName: z.string().nullable(),
});

export const priorityActionsSchema = z.object({
  items: z.array(priorityActionSchema),
  counts: z.object({
    critical: z.number(),
    high: z.number(),
    medium: z.number(),
    low: z.number(),
    total: z.number(),
  }),
});

export const expiryRiskItemSchema = z.object({
  batchId: z.string(),
  batchNumber: z.string(),
  productId: z.string(),
  sku: z.string(),
  productName: z.string(),
  category: z.string().nullable(),
  criticality: z.string(),
  warehouseId: z.string(),
  warehouseCode: z.string(),
  warehouseName: z.string(),
  tier: z.string(),
  quantity: z.number(),
  unitCost: z.number(),
  valueAtRisk: z.number(),
  expiryDate: z.string(),
  daysToExpiry: z.number(),
  severity: riskLevelSchema,
  avgDailyDemand: z.number(),
  projectedWaste: z.number(),
  projectedWasteValue: z.number(),
});

export const expiryRiskSchema = z.object({
  items: z.array(expiryRiskItemSchema),
  totals: z.object({
    batchCount: z.number(),
    quantity: z.number(),
    valueAtRisk: z.number(),
    projectedWaste: z.number(),
    projectedWasteValue: z.number(),
  }),
});

export type DashboardKPIs = z.infer<typeof dashboardKpisSchema>;
export type NetworkHealth = z.infer<typeof networkHealthSchema>;
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;
export type NetworkCenter = z.infer<typeof networkCenterSchema>;
export type PriorityAction = z.infer<typeof priorityActionSchema>;
export type PriorityActions = z.infer<typeof priorityActionsSchema>;
export type ExpiryRiskItem = z.infer<typeof expiryRiskItemSchema>;
export type ExpiryRisk = z.infer<typeof expiryRiskSchema>;
