import { z } from "zod";

/**
 * The simulation boundary. Follows `schemas/alerts.ts`.
 *
 * `POST /simulation/run` answers `202` with a scenario and a run to poll - it does
 * not return results, because the run has not executed yet. `latestRun` is null on a
 * scenario nothing has run.
 */

export const whatIfParamsSchema = z.object({
  demandShockPercent: z.number(),
  leadTimeChangePercent: z.number(),
  capacityChangePercent: z.number(),
  serviceLevelTargetPercent: z.number(),
});

export const savedScenarioRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  params: whatIfParamsSchema,
  multipliers: z.record(z.string(), z.number()),
  planningRunCount: z.number(),
  createdAt: z.string(),
  latestRun: z
    .object({
      id: z.string(),
      status: z.string(),
      horizonDays: z.number(),
      completedAt: z.string().nullable(),
    })
    .nullable()
    .optional(),
});

export const whatIfAcceptedSchema = z.object({
  scenario: savedScenarioRowSchema,
  run: z.object({ id: z.string(), status: z.string() }),
  pollAt: z.string(),
});

export type WhatIfParams = z.infer<typeof whatIfParamsSchema>;
export type SavedScenarioRow = z.infer<typeof savedScenarioRowSchema>;
export type WhatIfAccepted = z.infer<typeof whatIfAcceptedSchema>;
