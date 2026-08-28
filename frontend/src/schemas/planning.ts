import { z } from "zod";

/**
 * The planning boundary. Follows `schemas/alerts.ts`.
 *
 * `currentStage` and `progress` are nullable because a PENDING run has not entered a
 * stage yet, and `failureReason` / `failureStage` are null on every run that has not
 * failed. The status enum is closed: `planning.service.ts` writes exactly these five.
 */

export const planningRunStatusSchema = z.enum([
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);

export const planningRunSchema = z.object({
  id: z.string(),
  status: planningRunStatusSchema,
  horizonDays: z.number(),
  modelVersion: z.string().nullable(),
  scenario: z.object({ id: z.string(), name: z.string() }).nullable(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
  durationSeconds: z.number().nullable(),
  stale: z.boolean(),
  failureReason: z.string().nullable(),
  failureStage: z.string().nullable(),
  currentStage: z.string().nullable(),
  progress: z.number().nullable(),
});

export const deltaSchema = z.object({
  baseline: z.number(),
  scenario: z.number(),
  delta: z.number(),
  // Null when the baseline is zero - a percentage change from nothing is undefined,
  // not infinite.
  percentChange: z.number().nullable(),
});

export const runComparisonSchema = z.object({
  scenario: z.object({ id: z.string(), horizonDays: z.number() }),
  baseline: z.object({ id: z.string(), horizonDays: z.number() }),
  headline: z.object({
    stockoutDaysAvoided: z.number(),
    writeOffUnitsAvoided: z.number(),
    costSaved: z.number(),
    serviceLevelChange: z.number(),
    transfersProposed: z.number(),
  }),
  cost: z.object({
    holding: deltaSchema,
    stockout: deltaSchema,
    transfer: deltaSchema,
    expiry: deltaSchema,
    total: deltaSchema,
  }),
  risk: z.record(z.string(), deltaSchema),
  plan: z.record(z.string(), deltaSchema),
  warnings: z.array(z.string()),
});

export const runSimulationSchema = z.object({
  riskLevel: z.enum(["low", "moderate", "high", "critical"]),
  stockoutProbabilityPercent: z.number(),
  serviceLevelPercent: z.number(),
  planningRunId: z.string(),
  iterations: z.number(),
  serviceLevel: z.number(),
  stockoutProbability: z.number(),
  expiryProbability: z.number(),
  expectedInventory: z.number(),
  expectedWaste: z.number(),
  expectedCost: z.number(),
});

export const runOptimizationSchema = z.object({
  planningRunId: z.string(),
  totalCost: z.number(),
  holdingCost: z.number(),
  stockoutCost: z.number(),
  transferCost: z.number(),
  expiryCost: z.number(),
  componentSum: z.number(),
  solver: z.string(),
});

/**
 * Realised against planned, scored from the movement and demand ledgers.
 *
 * Every figure that needs evidence is nullable rather than zero: a run completed an
 * hour ago has no elapsed days, and reporting a 0% service level for it would read as
 * a total failure instead of "nothing has happened yet". `hasEvidence` is the flag to
 * branch on.
 */
export const runOutcomeSchema = z.object({
  planningRunId: z.string(),
  window: z.object({
    from: z.string(),
    to: z.string(),
    elapsedDays: z.number(),
    horizonDays: z.number(),
    coveragePercent: z.number(),
  }),
  demand: z.object({
    orderedUnits: z.number(),
    fulfilledUnits: z.number(),
    unmetUnits: z.number(),
    wasteUnits: z.number(),
    transferUnits: z.number(),
  }),
  serviceLevel: z.object({
    planned: z.number().nullable(),
    achieved: z.number().nullable(),
    achievedPercent: z.number().nullable(),
    delta: z.number().nullable(),
  }),
  cost: z.object({
    realised: z.object({
      holding: z.number(),
      stockout: z.number(),
      transfer: z.number(),
      expiry: z.number(),
      total: z.number(),
    }),
    plannedToDate: z.number().nullable(),
    plannedTotal: z.number().nullable(),
  }),
  hasEvidence: z.boolean(),
});

export type RunOutcome = z.infer<typeof runOutcomeSchema>;

export type PlanningRunStatus = z.infer<typeof planningRunStatusSchema>;
export type PlanningRun = z.infer<typeof planningRunSchema>;
export type Delta = z.infer<typeof deltaSchema>;
export type RunComparison = z.infer<typeof runComparisonSchema>;
export type RunSimulation = z.infer<typeof runSimulationSchema>;
export type RunOptimization = z.infer<typeof runOptimizationSchema>;
