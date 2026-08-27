/**
 * Movement arithmetic and the rules about which way each type moves stock.
 *
 * Pure and separate from the write path so the sign rules are testable without a
 * database - the same split `utils/supply.ts` uses.
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

export type MovementType = (typeof MOVEMENT_TYPES)[number];

/**
 * Which direction each type is allowed to move stock.
 *
 * `quantity` is a signed delta, so `stockAfter = stockBefore + quantity` holds for
 * every row. Only `ADJUSTMENT` may go either way - a stock count can correct upwards
 * or downwards, and forcing it into two types would make the ledger lie about what
 * happened.
 */
const DIRECTION: Record<MovementType, "in" | "out" | "either"> = {
  SALE: "out",
  RECEIPT: "in",
  TRANSFER_IN: "in",
  TRANSFER_OUT: "out",
  RETURN: "in",
  WASTAGE: "out",
  ADJUSTMENT: "either",
};

/** Types that represent realised customer demand, and so append to `DemandHistory`. */
const DEMAND_TYPES = new Set<MovementType>(["SALE"]);

export const isDemand = (type: MovementType): boolean => DEMAND_TYPES.has(type);

export const directionOf = (type: MovementType) => DIRECTION[type];

/**
 * Whether a quantity is a valid input for its movement type.
 *
 * **Directional types take a positive magnitude.** `{ SALE, 180 }` is "180 units went
 * out" - the type already says which way, so the caller does not also sign it. A
 * negative is rejected rather than interpreted, because `{ RECEIPT, -180 }` has two
 * plausible readings ("receive 180" or "reverse a receipt") and guessing between them
 * would silently move stock the wrong way.
 *
 * `ADJUSTMENT` is the exception: it is the one type whose direction is not implied, so
 * it takes a signed value and both signs are meaningful.
 *
 * Zero is rejected everywhere: a movement that moves nothing is not a correction, it
 * is a mistake, and it would put rows in the ledger no reader can act on.
 */
export const isValidQuantity = (type: MovementType, quantity: number): boolean => {
  if (!Number.isFinite(quantity) || quantity === 0) return false;
  return DIRECTION[type] === "either" ? true : quantity > 0;
};

/**
 * The signed delta a caller's input represents.
 *
 * The type carries the direction, so an outward type negates the magnitude it was
 * given. `ADJUSTMENT` is taken literally in both directions.
 */
export const deltaFor = (type: MovementType, quantity: number): number => {
  const direction = DIRECTION[type];
  if (direction === "either") return quantity;
  return direction === "out" ? -Math.abs(quantity) : Math.abs(quantity);
};

export interface StockChange {
  stockBefore: number;
  stockAfter: number;
  delta: number;
}

/**
 * Applies a delta to a position.
 *
 * Stock is floored at zero rather than allowed negative, and the **applied** delta is
 * reported rather than the requested one - so `stockAfter = stockBefore + delta` still
 * holds on a row that was clamped, and the ledger stays internally consistent instead
 * of recording an intent that did not happen.
 */
export const applyDelta = (onHand: number, delta: number): StockChange => {
  const stockAfter = Math.max(0, onHand + delta);
  return { stockBefore: onHand, stockAfter, delta: stockAfter - onHand };
};

/** Whether a delta would have driven the position below zero and was clamped. */
export const wasClamped = (onHand: number, requested: number): boolean =>
  onHand + requested < 0;
