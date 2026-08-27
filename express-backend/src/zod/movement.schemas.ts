import { z } from "zod";
import { MOVEMENT_TYPES } from "../utils/movement.js";

const text = z.string().trim().min(1);

export const dcParamsSchema = z.object({ code: text });

/**
 * Recording a movement.
 *
 * `quantity` is a **positive magnitude** on every directional type: `{ SALE, 180 }` is
 * "180 units went out", because the type already carries the direction. A negative is
 * rejected rather than interpreted - `{ RECEIPT, -180 }` reads both as "receive 180"
 * and as "reverse a receipt", and guessing would silently move stock the wrong way.
 * `ADJUSTMENT` is the exception and takes a signed value.
 *
 * Strict: an unknown key here is a caller sending a field this route does not apply,
 * and silently dropping it would look like the movement recorded something it did not.
 */
export const recordMovementBodySchema = z.strictObject({
  sku: text,
  movementType: z.enum(MOVEMENT_TYPES),
  quantity: z.number().finite(),
  reference: text.max(200).optional(),
  notes: text.max(500).optional(),
  /** Free text on both, because a counterparty may be outside the network. */
  fromLocation: text.max(120).optional(),
  toLocation: text.max(120).optional(),
  /** Defaults to now. Accepted so a batch import can replay a day. */
  date: z.coerce.date().optional(),
  /**
   * The restock request this arrival satisfies, if any. Naming it here is what closes
   * the request - `FULFILLED` is reached by recording the stock, not by a separate
   * button that claims stock arrived without any arriving.
   */
  restockRequestId: text.optional(),
});

export const movementQuerySchema = z.object({
  dc: text.optional(),
  warehouse: text.optional(),
  sku: text.optional(),
  type: z.enum(MOVEMENT_TYPES).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const restockRequestBodySchema = z.strictObject({
  sku: text,
  warehouse: text,
  quantity: z.number().finite().positive(),
  reason: text.max(500).optional(),
  notes: text.max(500).optional(),
});

export const restockQuerySchema = z.object({
  warehouse: text.optional(),
  sku: text.optional(),
  status: z.enum(["REQUESTED", "APPROVED", "REJECTED", "FULFILLED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const restockParamsSchema = z.object({ id: text });

export const inventoryPlanQuerySchema = z.object({
  sku: text.optional(),
  warehouse: text.optional(),
});

export const runParamsSchema = z.object({ id: text });

export type DcParams = z.infer<typeof dcParamsSchema>;
export type RecordMovementBody = z.infer<typeof recordMovementBodySchema>;
export type MovementQuery = z.infer<typeof movementQuerySchema>;
export type RestockRequestBody = z.infer<typeof restockRequestBodySchema>;
export type RestockQuery = z.infer<typeof restockQuerySchema>;
export type RestockParams = z.infer<typeof restockParamsSchema>;
export type InventoryPlanQuery = z.infer<typeof inventoryPlanQuerySchema>;
