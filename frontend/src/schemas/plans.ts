import { z } from "zod";

/**
 * The supply-plan and DRP boundary. Follows `schemas/alerts.ts`.
 *
 * Both routes are run-scoped: `planningRunId` is null when no run has completed, and
 * the item list is then empty rather than fabricated. Phase 5 builds the page these
 * feed; the module is written now so the contract is parsed like every other.
 */

export const planStatusSchema = z.enum(["PROPOSED", "APPROVED", "REJECTED"]);

export const supplyPlanSchema = z.object({
  id: z.string(),
  planningRunId: z.string(),
  productId: z.string(),
  sku: z.string(),
  productName: z.string(),
  criticality: z.string(),
  warehouseId: z.string(),
  warehouseCode: z.string(),
  warehouseName: z.string(),
  tier: z.string(),
  date: z.string(),
  quantity: z.number(),
  /** `EXISTING` in transit, `TRANSFER` from a DRP lane, `PLANNED_SUPPLY` on cadence. */
  source: z.string(),
  status: planStatusSchema,
});

/**
 * `GET /supply-plans` is a **paginated** route: `data` is the array itself, and
 * `total` / `planningRunId` travel in `meta`. Parse the array; read the rest off meta.
 */
export const supplyPlanListSchema = z.array(supplyPlanSchema);

export const drpPlanSchema = z.object({
  id: z.string(),
  planningRunId: z.string(),
  productId: z.string(),
  sku: z.string(),
  productName: z.string(),
  fromWarehouseId: z.string(),
  fromWarehouseCode: z.string(),
  fromWarehouseName: z.string(),
  toWarehouseId: z.string(),
  toWarehouseCode: z.string(),
  toWarehouseName: z.string(),
  date: z.string(),
  quantity: z.number(),
  reason: z.string().nullable(),
  status: planStatusSchema,
});

/**
 * `GET /drp-plans` also paginates, but its `data` carries `totalUnits` alongside the
 * items - the units moving across the whole filtered set, not just this page, so a
 * planner asking "how much is moving" does not have to add up every page.
 */
export const drpPlanListSchema = z.object({
  items: z.array(drpPlanSchema),
  totalUnits: z.number(),
});

export type PlanStatus = z.infer<typeof planStatusSchema>;
export type SupplyPlan = z.infer<typeof supplyPlanSchema>;
export type SupplyPlanList = z.infer<typeof supplyPlanListSchema>;
export type DrpPlan = z.infer<typeof drpPlanSchema>;
export type DrpPlanList = z.infer<typeof drpPlanListSchema>;
