import { z } from "zod";
import { WarehouseTier } from "../../generated/prisma/enums.js";

const identifier = z.string().trim().min(1);

export const networkQuerySchema = z.object({
  tier: z.enum(WarehouseTier).optional(),
});

export const inventoryHealthQuerySchema = z.object({
  warehouseId: identifier.optional(),
});

export const expiryRiskQuerySchema = z.object({
  withinDays: z.coerce.number().int().min(1).max(365).default(90),
  warehouseId: identifier.optional(),
  sku: identifier.optional(),
  severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const priorityActionsQuerySchema = z.object({
  warehouseId: identifier.optional(),
  severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  type: z
    .enum([
      "TRANSFER_OPPORTUNITY",
      "STOCKOUT_IMMINENT",
      "BELOW_REORDER_POINT",
      "EXPIRY_WRITE_OFF",
      "EXCESS_STOCK",
    ])
    .optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type PriorityActionsQuery = z.infer<typeof priorityActionsQuerySchema>;
export type NetworkQuery = z.infer<typeof networkQuerySchema>;
export type InventoryHealthQuery = z.infer<typeof inventoryHealthQuerySchema>;
export type ExpiryRiskQuery = z.infer<typeof expiryRiskQuerySchema>;
