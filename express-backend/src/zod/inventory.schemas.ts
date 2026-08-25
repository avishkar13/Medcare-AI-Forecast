import { z } from "zod";
import { Criticality } from "../../generated/prisma/enums.js";

const text = z.string().trim().min(1);

export const inventoryStatuses = [
  "criticalStock",
  "belowReorderPoint",
  "expiringSoon",
  "excessStock",
  "healthy",
] as const;

export const inventorySorts = ["sku", "risk", "daysOfSupply", "inventoryValue"] as const;

export const inventoryQuerySchema = z.object({
  search: text.optional(),
  category: text.optional(),
  warehouse: text.optional(),
  criticality: z.enum(Criticality).optional(),
  status: z.enum(inventoryStatuses).optional(),
  risk: z.enum(["critical", "high", "medium", "low"]).optional(),
  sort: z.enum(inventorySorts).default("sku"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const skuInventoryParamsSchema = z.object({ id: text });

export type InventoryQuery = z.infer<typeof inventoryQuerySchema>;
export type SkuInventoryParams = z.infer<typeof skuInventoryParamsSchema>;
