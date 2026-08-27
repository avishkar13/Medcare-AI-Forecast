import { z } from "zod";

/**
 * The planning-parameter boundary. Follows `schemas/alerts.ts`.
 *
 * These ten numbers are what the executor plans with, per product per DC.
 * `reviewPeriodDays` is the brief's review cadence in its most literal form, and
 * `maximumInventory` is nullable because a pair may have no ceiling configured.
 */

export const planningParameterSchema = z.object({
  id: z.string(),
  productId: z.string(),
  sku: z.string(),
  productName: z.string(),
  criticality: z.string(),
  warehouseId: z.string(),
  warehouseCode: z.string(),
  warehouseName: z.string(),
  tier: z.string(),
  leadTimeDays: z.number(),
  leadTimeStdDev: z.number(),
  serviceLevel: z.number(),
  reviewPeriodDays: z.number(),
  minimumOrderQty: z.number(),
  maximumInventory: z.number().nullable(),
  holdingCostPerUnit: z.number(),
  stockoutCostPerUnit: z.number(),
  expiryCostPerUnit: z.number(),
});

export type PlanningParameter = z.infer<typeof planningParameterSchema>;
