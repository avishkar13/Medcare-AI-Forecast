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
  /**
   * Per item-location alert overrides. **Null means inherit** the global setting in
   * Settings > Alerts - not zero, and not disabled. Nullable rather than optional
   * because the server always sends the field; the value itself is the signal.
   */
  alertStockoutProbability: z.number().nullable(),
  alertExpiryWindowDays: z.number().nullable(),
  /** A floor in units. Null means the rule is off here - there is no global to inherit. */
  minimumStockUnits: z.number().nullable(),
});

export type PlanningParameter = z.infer<typeof planningParameterSchema>;
