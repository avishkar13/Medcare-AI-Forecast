import { z } from "zod";

/**
 * The inventory boundary. Follows `schemas/alerts.ts`.
 *
 * `category` and `maximumInventory` are nullable here because they are nullable in
 * the database and the backend passes them through untouched - `types/inventory.ts`
 * declared `category: string`, which is the drift this file exists to catch.
 *
 * `status` and `risk` are the two the backend does constrain (`zod/inventory.schemas.ts`
 * enumerates both), so they are enums rather than open strings.
 */

export const riskLevelSchema = z.enum(["critical", "high", "medium", "low"]);

export const inventoryStatusSchema = z.enum([
  "criticalStock",
  "belowReorderPoint",
  "expiringSoon",
  "excessStock",
  "healthy",
]);

export const inventoryPositionSchema = z.object({
  productId: z.string(),
  sku: z.string(),
  productName: z.string(),
  category: z.string().nullable(),
  criticality: z.string(),
  warehouseId: z.string(),
  warehouseCode: z.string(),
  warehouseName: z.string(),
  tier: z.string(),
  onHand: z.number(),
  reserved: z.number(),
  inTransit: z.number(),
  available: z.number(),
  safetyStock: z.number(),
  reorderPoint: z.number(),
  maximumInventory: z.number().nullable(),
  avgDailyDemand: z.number(),
  leadTimeDays: z.number(),
  daysOfSupply: z.number(),
  unitCost: z.number(),
  inventoryValue: z.number(),
  expiringUnits: z.number(),
  expiringValue: z.number(),
  bufferCoveragePercent: z.number(),
  daysToNearestExpiry: z.number().nullable(),
  status: inventoryStatusSchema,
  risk: riskLevelSchema,
});

export const inventoryTotalsSchema = z.object({
  positionCount: z.number(),
  skuCount: z.number(),
  warehouseCount: z.number(),
  onHandUnits: z.number(),
  inventoryValue: z.number(),
  belowSafetyStockCount: z.number(),
  belowReorderPointCount: z.number(),
  aboveMaximumCount: z.number(),
  expiringValue: z.number(),
  inStockRatePercent: z.number(),
});

export const inventoryListSchema = z.object({
  items: z.array(inventoryPositionSchema),
  totals: inventoryTotalsSchema,
});

export const inventoryBatchSchema = z.object({
  batchId: z.string(),
  batchNumber: z.string(),
  warehouseCode: z.string(),
  warehouseName: z.string(),
  quantity: z.number(),
  unitCost: z.number(),
  valueAtRisk: z.number(),
  manufacturingDate: z.string().nullable(),
  expiryDate: z.string(),
  daysToExpiry: z.number(),
  severity: riskLevelSchema,
});

export const skuNetworkPositionSchema = z.object({
  warehouseCount: z.number(),
  onHand: z.number(),
  available: z.number(),
  safetyStock: z.number(),
  reorderPoint: z.number(),
  maximumInventory: z.number(),
  avgDailyDemand: z.number(),
  inventoryValue: z.number(),
  expiringUnits: z.number(),
  expiringValue: z.number(),
  leadTimeDays: z.number(),
  daysOfSupply: z.number(),
  risk: riskLevelSchema,
  stockScaleUnits: z.number(),
});

export const inventoryDetailSchema = z.object({
  product: z.object({
    id: z.string(),
    sku: z.string(),
    name: z.string(),
    category: z.string().nullable(),
    unit: z.string(),
    unitCost: z.number(),
    shelfLifeDays: z.number().nullable(),
    criticality: z.string(),
  }),
  totals: inventoryTotalsSchema,
  network: skuNetworkPositionSchema,
  positions: z.array(inventoryPositionSchema),
  batches: z.array(inventoryBatchSchema),
});

export const inventoryHealthSchema = z.object({
  breakdown: z.object({
    criticalStock: z.number(),
    belowReorderPoint: z.number(),
    expiringSoon: z.number(),
    excessStock: z.number(),
    healthy: z.number(),
    total: z.number(),
  }),
  breakdownPercent: z.object({
    criticalStock: z.number(),
    belowReorderPoint: z.number(),
    expiringSoon: z.number(),
    excessStock: z.number(),
    healthy: z.number(),
  }),
  totalInventoryValue: z.number(),
  conditions: z.record(z.string(), z.number()),
  byCategory: z.array(
    z.object({
      category: z.string(),
      /** Distinct products in this category, within the current scope. */
      skuCount: z.number(),
      /**
       * Product-warehouse pairs. Four times `skuCount` network-wide, equal to it per DC.
       * These were one field called `skuCount` that actually counted positions, which is
       * why the category figures looked identical whichever DC was selected.
       */
      positionCount: z.number(),
      inventoryValue: z.number(),
      atRiskCount: z.number(),
      expiringValue: z.number(),
    }),
  ),
});

export type RiskLevel = z.infer<typeof riskLevelSchema>;
export type InventoryStatus = z.infer<typeof inventoryStatusSchema>;
export type InventoryPosition = z.infer<typeof inventoryPositionSchema>;
export type InventoryTotals = z.infer<typeof inventoryTotalsSchema>;
export type InventoryList = z.infer<typeof inventoryListSchema>;
export type InventoryBatch = z.infer<typeof inventoryBatchSchema>;
export type InventoryDetail = z.infer<typeof inventoryDetailSchema>;
export type SkuNetworkPosition = z.infer<typeof skuNetworkPositionSchema>;
export type InventoryHealth = z.infer<typeof inventoryHealthSchema>;
