import { z } from "zod";
import { Criticality, WarehouseTier } from "../../generated/prisma/enums.js";

const page = z.coerce.number().int().min(1).default(1);
const pageSize = z.coerce.number().int().min(1).max(200).default(50);
const text = z.string().trim().min(1);

export const productQuerySchema = z.object({
  search: text.optional(),
  category: text.optional(),
  criticality: z.enum(Criticality).optional(),
  isActive: z.stringbool().optional(),
  page,
  pageSize,
});

export const productParamsSchema = z.object({ id: text });

export const warehouseParamsSchema = z.object({ id: text });

export const distributorQuerySchema = z.object({
  /** Warehouse cuid or `code`. */
  warehouse: text.optional(),
  region: text.optional(),
  isActive: z.stringbool().optional(),
});

export const promotionQuerySchema = z.object({
  /**
   * `true` is still-running or scheduled (`endDate >= today`), not `startDate > now`
   * - a promotion running right now is the most relevant one there is.
   */
  upcoming: z.stringbool().optional(),
  page,
  pageSize,
});

export const warehouseQuerySchema = z.object({
  tier: z.enum(WarehouseTier).optional(),
  region: text.optional(),
  isActive: z.stringbool().optional(),
});

export type ProductQuery = z.infer<typeof productQuerySchema>;
export type ProductParams = z.infer<typeof productParamsSchema>;
export type WarehouseQuery = z.infer<typeof warehouseQuerySchema>;
export type WarehouseParams = z.infer<typeof warehouseParamsSchema>;
export type DistributorQuery = z.infer<typeof distributorQuerySchema>;
export type PromotionQuery = z.infer<typeof promotionQuerySchema>;
