import { z } from "zod";

const text = z.string().trim().min(1);

/**
 * Every forecast read route shares these. A route group that reads one planning
 * run's artefacts needs to say *which* run, and every caller wants the same
 * product/warehouse narrowing.
 */
export const forecastQuerySchema = z.object({
  /** Defaults to the most recent COMPLETED run. */
  runId: text.optional(),
  /** Product cuid or `sku`. */
  sku: text.optional(),
  /** Warehouse cuid or `code`. */
  warehouse: text.optional(),
  /** Days of the horizon to include, counted from the run's first forecast day. */
  days: z.coerce.number().int().min(1).max(365).optional(),
});

/** `main-chart` additionally carries history, which is bounded separately. */
export const forecastChartQuerySchema = forecastQuerySchema.extend({
  historyDays: z.coerce.number().int().min(0).max(365).default(60),
});

export type ForecastQuery = z.infer<typeof forecastQuerySchema>;
export type ForecastChartQuery = z.infer<typeof forecastChartQuerySchema>;
