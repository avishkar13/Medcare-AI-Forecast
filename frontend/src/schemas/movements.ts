import { z } from "zod";

/**
 * The execution-loop boundary. Follows `schemas/alerts.ts`.
 *
 * `quantity` is a **signed delta** on the wire, so `stockAfter = stockBefore +
 * quantity` holds for every row and the ledger renders without the client having to
 * know which types subtract. The write side is the opposite: a directional type takes
 * a positive magnitude, because the type already carries the direction.
 */

export const MOVEMENT_TYPES = [
  "SALE",
  "RECEIPT",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "RETURN",
  "WASTAGE",
  "ADJUSTMENT",
] as const;

export const movementTypeSchema = z.enum(MOVEMENT_TYPES);

export const stockMovementSchema = z.object({
  id: z.string(),
  date: z.string(),
  movementType: z.string(),
  sku: z.string(),
  productId: z.string(),
  productName: z.string(),
  warehouseId: z.string(),
  dc: z.string(),
  warehouseName: z.string(),
  quantity: z.number(),
  stockBefore: z.number(),
  stockAfter: z.number(),
  fromLocation: z.string().nullable(),
  toLocation: z.string().nullable(),
  reference: z.string().nullable(),
  userOrSystem: z.string().nullable(),
  /** The alert this movement raised, when it raised one. */
  triggeredAlertId: z.string().nullable(),
  createdAt: z.string(),
});

export const restockStatusSchema = z.enum(["REQUESTED", "APPROVED", "REJECTED", "FULFILLED"]);

export const restockRequestSchema = z.object({
  id: z.string(),
  productId: z.string(),
  sku: z.string(),
  productName: z.string(),
  criticality: z.string(),
  warehouseId: z.string(),
  warehouseCode: z.string(),
  warehouseName: z.string(),
  tier: z.string(),
  quantity: z.number(),
  status: restockStatusSchema,
  reason: z.string().nullable(),
  notes: z.string().nullable(),
  requestedById: z.string().nullable(),
  decidedById: z.string().nullable(),
  decidedAt: z.string().nullable(),
  fulfilledAt: z.string().nullable(),
  fulfillmentMovementId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const recordMovementResultSchema = z.object({
  movement: stockMovementSchema,
  inventory: z.object({
    productId: z.string(),
    warehouseId: z.string(),
    onHand: z.number(),
    reserved: z.number(),
    inTransit: z.number(),
    available: z.number(),
    updatedAt: z.string(),
  }),
  alertsRaised: z.array(
    z.object({
      id: z.string(),
      severity: z.string(),
      type: z.string(),
      title: z.string(),
    }),
  ),
  /** The restock request this arrival closed, when the body named one. */
  restockRequest: restockRequestSchema.nullable(),
  /** True when the caller asked to move more than existed and the movement was cut short. */
  clamped: z.boolean(),
});

export const dcSyncSchema = z.object({
  warehouseId: z.string(),
  code: z.string(),
  name: z.string(),
  isActive: z.boolean(),
  /** Null until the DC has reported once - "never", not a stale timestamp. */
  lastSyncedAt: z.string().nullable(),
  minutesSinceSync: z.number().nullable(),
  status: z.enum(["never", "stale", "live"]),
  movementsToday: z.number(),
  positionsHeld: z.number(),
  onHandUnits: z.number(),
  lastMovement: stockMovementSchema.nullable(),
});

export const inventoryPlanPointSchema = z.object({
  date: z.string(),
  projectedOnHand: z.number(),
  openingInventory: z.number(),
  forecastDemand: z.number(),
  safetyStock: z.number(),
  reorderPoint: z.number(),
  netRequirement: z.number(),
  daysOfSupply: z.number().nullable(),
  // Null when the run produced no forecast row for this day - a fallback run can plan
  // more days than it forecast, and a fabricated band would be worse than a gap.
  p10: z.number().nullable(),
  p50: z.number().nullable(),
  p90: z.number().nullable(),
});

export const inventoryPlanSchema = z.object({
  planningRunId: z.string(),
  status: z.string(),
  horizonDays: z.number(),
  /** `position` is one curve; `aggregate` is every pair overlaid, which no chart reads. */
  scope: z.enum(["position", "aggregate"]),
  points: z.array(inventoryPlanPointSchema),
  /** The first day the projection crosses zero, read off the curve. */
  stockoutDate: z.string().nullable(),
});

export type MovementType = z.infer<typeof movementTypeSchema>;
export type StockMovement = z.infer<typeof stockMovementSchema>;
export type RecordMovementResult = z.infer<typeof recordMovementResultSchema>;
export type DcSync = z.infer<typeof dcSyncSchema>;
export type InventoryPlanPoint = z.infer<typeof inventoryPlanPointSchema>;
export type InventoryPlan = z.infer<typeof inventoryPlanSchema>;
export type RestockStatus = z.infer<typeof restockStatusSchema>;
export type RestockRequest = z.infer<typeof restockRequestSchema>;
