import { z } from "zod";

const text = z.string().trim().min(1);

/**
 * The UI works in percentage changes; a Scenario stores multipliers. The bounds
 * mirror `scenario.schemas.ts` (0.1x to 5x) expressed as percentages, so the two
 * ways of creating a scenario cannot accept different things.
 */
export const simulationParamsSchema = z.strictObject({
  demandShockPercent: z.number().min(-90).max(400).default(0),
  leadTimeChangePercent: z.number().min(-90).max(400).default(0),
  capacityChangePercent: z.number().min(-90).max(400).default(0),
  serviceLevelTargetPercent: z.number().min(50).max(99.9).default(95),
});

export const whatIfBodySchema = z.strictObject({
  name: text.max(120),
  description: text.max(500).optional(),
  horizonDays: z.number().int().min(1).max(365).default(30),
  params: simulationParamsSchema.default({
    demandShockPercent: 0,
    leadTimeChangePercent: 0,
    capacityChangePercent: 0,
    serviceLevelTargetPercent: 95,
  }),
});

export const saveScenarioBodySchema = z.strictObject({
  name: text.max(120),
  description: text.max(500).optional(),
  params: simulationParamsSchema.default({
    demandShockPercent: 0,
    leadTimeChangePercent: 0,
    capacityChangePercent: 0,
    serviceLevelTargetPercent: 95,
  }),
});

export const simulationListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const scenarioIdParamsSchema = z.object({ id: text });

export type SimulationParams = z.infer<typeof simulationParamsSchema>;
export type WhatIfBody = z.infer<typeof whatIfBodySchema>;
export type SaveScenarioBody = z.infer<typeof saveScenarioBodySchema>;
export type SimulationListQuery = z.infer<typeof simulationListQuerySchema>;
