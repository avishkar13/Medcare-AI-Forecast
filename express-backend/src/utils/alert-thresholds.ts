/**
 * Which threshold governs a given position.
 *
 * Alert thresholds are global by default and overridable per item-location. Real
 * replenishment policy is set that way because a SKU does not behave the same at every
 * site: a critical antibiotic at a Tier-2 DC with a fortnight of lead time cannot be
 * judged by the number that suits a routine analgesic at a metro DC two days from its
 * supplier.
 *
 * Pure and separate from the detector that consumes it, so the precedence rule is
 * testable without a database - the same split `utils/supply.ts` uses.
 */

/** The global values, from `AlertSettings`. Always complete. */
export interface GlobalAlertThresholds {
  stockoutProbability: number;
  expiryWindow: number;
}

/**
 * A position's overrides, from `PlanningParameter`.
 *
 * **Null means inherit**, per field - not zero, not disabled. A position that overrides
 * only its expiry window keeps the global stockout probability.
 */
export interface AlertThresholdOverride {
  alertStockoutProbability?: number | null;
  alertExpiryWindowDays?: number | null;
  /**
   * A floor in units. Unlike the two above it has **no global counterpart** - one unit
   * count across forty SKUs could not be right for any of them - so null here means the
   * rule is simply not in play for this position, not "inherit".
   */
  minimumStockUnits?: number | null;
}

export interface ResolvedAlertThresholds {
  stockoutProbability: number;
  expiryWindow: number;
  /** The unit floor, or null when this position has none set. */
  minimumStockUnits: number | null;
  /** Which fields were overridden, so an alert can say what it was judged against. */
  overridden: { stockoutProbability: boolean; expiryWindow: boolean };
}

/**
 * Field-by-field, an override beats the global value.
 *
 * Deliberately not all-or-nothing: treating a partially-filled override as "use the
 * override object" would turn an unset field into a zero threshold, which fires an alert
 * on every position at once.
 */
export const resolveThresholds = (
  global: GlobalAlertThresholds,
  override?: AlertThresholdOverride | null,
): ResolvedAlertThresholds => {
  const stockout = override?.alertStockoutProbability;
  const expiry = override?.alertExpiryWindowDays;

  const hasStockout = stockout !== null && stockout !== undefined;
  const hasExpiry = expiry !== null && expiry !== undefined;

  // A floor of zero is not a floor: it would arm on a position that is already empty
  // and says nothing the probability rule has not said. Treated as unset.
  const minimum = override?.minimumStockUnits;
  const hasMinimum = minimum !== null && minimum !== undefined && minimum > 0;

  return {
    stockoutProbability: hasStockout ? stockout : global.stockoutProbability,
    expiryWindow: hasExpiry ? expiry : global.expiryWindow,
    minimumStockUnits: hasMinimum ? minimum : null,
    overridden: { stockoutProbability: hasStockout, expiryWindow: hasExpiry },
  };
};

/**
 * The widest expiry window any position could ask for.
 *
 * The detector loads candidate batches with a single query, so it has to reach far
 * enough for the most generous override in play - otherwise a position that widened its
 * window would silently never see the batches it just asked about. Each pair is then
 * judged against its own resolved window.
 */
export const widestExpiryWindow = (
  global: GlobalAlertThresholds,
  overrides: readonly AlertThresholdOverride[],
): number =>
  overrides.reduce(
    (widest, override) =>
      override.alertExpiryWindowDays === null || override.alertExpiryWindowDays === undefined
        ? widest
        : Math.max(widest, override.alertExpiryWindowDays),
    global.expiryWindow,
  );
