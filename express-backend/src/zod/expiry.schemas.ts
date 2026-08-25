import { z } from "zod";

const text = z.string().trim().min(1);

export const expiryQuerySchema = z.object({
  /** Product cuid or `sku`. */
  sku: text.optional(),
  /** Warehouse cuid or `code`. */
  warehouse: text.optional(),
  /** Only batches expiring within this many days. */
  withinDays: z.coerce.number().int().min(1).max(3650).optional(),
});

export const expiryBatchQuerySchema = expiryQuerySchema.extend({
  risk: z.enum(["critical", "high", "medium", "low"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type ExpiryQuery = z.infer<typeof expiryQuerySchema>;
export type ExpiryBatchQuery = z.infer<typeof expiryBatchQuerySchema>;
