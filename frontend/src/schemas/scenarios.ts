import { z } from "zod";

/**
 * The scenario boundary. Follows `schemas/alerts.ts`.
 *
 * `serviceLevelTarget` is nullable and that is load-bearing: null means "use each
 * pair's own `PlanningParameter.serviceLevel`", and a number means "apply this one
 * network-wide". The neutral scenario is null. Coercing it to a default here would
 * reintroduce exactly the bug the roadmap records - two runs at different service
 * levels producing byte-identical safety stock.
 */

export const scenarioSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  demandMultiplier: z.number(),
  leadTimeMultiplier: z.number(),
  capacityMultiplier: z.number(),
  serviceLevelTarget: z.number().nullable(),
  createdById: z.string(),
  createdAt: z.string(),
  /**
   * How many runs have been executed under this scenario. A scenario with none has
   * never been tested; one with several is safe to compare against.
   */
  planningRunCount: z.number(),
});

export type Scenario = z.infer<typeof scenarioSchema>;
