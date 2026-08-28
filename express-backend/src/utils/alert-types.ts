/**
 * The alert types, in one place.
 *
 * These strings existed only as literals inside `alert-detector.service.ts`, while
 * `settings.service.ts` seeded notification rules keyed on human labels - "Critical
 * Stockout" against `stockout_risk`. `routeAlert` matches a rule with
 * `entry.event === alert.type`, so no rule ever matched, every lookup fell through to
 * its default, and `rule?.email ?? false` silently disabled email and SMS on every
 * alert the system has ever raised. In-app kept working because its default is `true`.
 *
 * One exported list is the fix: the detector's drafts are typed against it and the
 * rule defaults are generated from it, so a new detector cannot ship without a rule
 * and a rule cannot name an event that no detector emits.
 */

export const ALERT_TYPES = [
  "stockout_risk",
  "expiry_risk",
  "overstock",
  "capacity_breach",
  "demand_spike",
  "supplier_delay",
] as const;

export type AlertType = (typeof ALERT_TYPES)[number];

/**
 * What a reader sees. The settings screen renders the stored key directly, so without
 * this it would show `stockout_risk` in a table a planner is meant to configure.
 */
export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  stockout_risk: "Stockout risk",
  expiry_risk: "Expiry risk",
  overstock: "Overstock",
  capacity_breach: "Capacity breach",
  demand_spike: "Demand spike",
  supplier_delay: "Supplier delay",
};

export const isAlertType = (value: string): value is AlertType =>
  (ALERT_TYPES as readonly string[]).includes(value);
