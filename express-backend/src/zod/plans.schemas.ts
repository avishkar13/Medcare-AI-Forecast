import { z } from "zod";
import { PlanStatus, SupplySource } from "../../generated/prisma/enums.js";

const text = z.string().trim().min(1);
const page = z.coerce.number().int().min(1).default(1);
const pageSize = z.coerce.number().int().min(1).max(200).default(50);

export const supplyPlanQuerySchema = z.object({
  /** Defaults to the most recent COMPLETED run. */
  runId: text.optional(),
  sku: text.optional(),
  warehouse: text.optional(),
  status: z.enum(PlanStatus).optional(),
  source: z.enum(SupplySource).optional(),
  page,
  pageSize,
});

export const drpQuerySchema = z.object({
  runId: text.optional(),
  sku: text.optional(),
  /** Matches transfers where this warehouse is either the source or the destination. */
  warehouse: text.optional(),
  status: z.enum(PlanStatus).optional(),
  page,
  pageSize,
});

export const planParamsSchema = z.object({ id: text });

export type SupplyPlanQuery = z.infer<typeof supplyPlanQuerySchema>;
export type DrpQuery = z.infer<typeof drpQuerySchema>;
