import { z } from "zod";

/**
 * The master data boundary. Follows `schemas/alerts.ts`.
 *
 * Two drifts this file corrects, both found by writing it against
 * `services/masterdata.service.ts` rather than against the hand-written interfaces:
 *
 * - `category`, `region`, `shelfLifeDays`, `location` and `capacity` are optional
 *   columns and arrive as null. The interfaces declared the first three as required
 *   strings, so a product with no category rendered as `undefined`.
 * - **Promotion was wrong throughout.** The interface declared `region` and
 *   `upliftPercent`; the route returns `upliftFactor`, `warehouseId`, `sku`,
 *   `productName`, `warehouseCode`, `type` and a computed `scope`, and `productId` is
 *   nullable because a promotion can apply network-wide.
 */

export const productSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  category: z.string().nullable(),
  unit: z.string(),
  unitCost: z.number(),
  shelfLifeDays: z.number().nullable(),
  criticality: z.string(),
  isActive: z.boolean(),
});

export const warehouseSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  region: z.string().nullable(),
  tier: z.string(),
  location: z.string().nullable(),
  capacity: z.number().nullable(),
  isActive: z.boolean(),
});

export const distributorSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  region: z.string().nullable(),
  isActive: z.boolean(),
  warehouseId: z.string().nullable(),
  warehouseCode: z.string().nullable(),
  warehouseName: z.string().nullable(),
  orderCount: z.number(),
});

export const promotionSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  /** A multiplier, not a percentage: 1.6 means +60%. */
  upliftFactor: z.number(),
  // Null on either means the promotion applies network-wide or to every product.
  productId: z.string().nullable(),
  sku: z.string().nullable(),
  productName: z.string().nullable(),
  warehouseId: z.string().nullable(),
  warehouseCode: z.string().nullable(),
  scope: z.enum(["product-warehouse", "product", "warehouse", "network"]),
});

export type Product = z.infer<typeof productSchema>;
export type Warehouse = z.infer<typeof warehouseSchema>;
export type Distributor = z.infer<typeof distributorSchema>;
export type Promotion = z.infer<typeof promotionSchema>;
