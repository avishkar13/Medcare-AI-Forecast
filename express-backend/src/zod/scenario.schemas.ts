import { z } from "zod";

const text = z.string().trim().min(1);

// Every multiplier shares the same band. Below 0.1 the arithmetic stops meaning
// anything (a tenth of the lead time, a tenth of the capacity); above 5 a run is
// modelling a different business rather than a stress case.
const multiplier = z.number().positive().min(0.1).max(5);

export const createScenarioBodySchema = z.strictObject({
  name: text.max(120),
  description: text.max(500).optional(),
  demandMultiplier: multiplier.default(1),
  leadTimeMultiplier: multiplier.default(1),
  capacityMultiplier: multiplier.default(1),
  // A service level is a probability, and the safety-stock z-score blows up as it
  // approaches 1. Below 0.5 the buffer goes negative and gets clamped to zero anyway.
  serviceLevelTarget: z.number().min(0.5).max(0.999).default(0.95),
});

export const scenarioQuerySchema = z.object({
  search: text.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const scenarioParamsSchema = z.object({ id: text });

export type CreateScenarioBody = z.infer<typeof createScenarioBodySchema>;
export type ScenarioQuery = z.infer<typeof scenarioQuerySchema>;
export type ScenarioParams = z.infer<typeof scenarioParamsSchema>;
