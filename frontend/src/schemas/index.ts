/**
 * Every API response boundary.
 *
 * All sixteen were `export {};` before Phase 2, which meant `api.get<T>()` cast into
 * hand-written interfaces with nothing checking the cast: a renamed backend field
 * shipped silently and surfaced as `undefined` inside a chart. Writing them found
 * four real drifts - a nullable `category` declared as required, `Promotion` wrong in
 * five fields, `PriorityAction` missing the `warehouseId` its links needed, and
 * recommendation `signals` discarded while the card was ready to render them.
 *
 * `schemas/alerts.ts` is the reference for the rules: permissive where the backend is
 * permissive, `.nullable()` not `.optional()` where the backend returns null for a
 * figure it cannot derive, lists validated per row with bad rows dropped and logged.
 */
export * from "./alerts";
export * from "./auth";
export * from "./common";
export * from "./dashboard";
export * from "./expiry";
export * from "./forecast";
export * from "./inventory";
export * from "./masterdata";
export * from "./models";
export * from "./movements";
export * from "./parameters";
export * from "./planning";
export * from "./plans";
export * from "./recommendations";
export * from "./scenarios";
export * from "./settings";
export * from "./simulation";
