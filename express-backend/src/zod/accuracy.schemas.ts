import { z } from "zod";

const text = z.string().trim().min(1);

export const accuracyQuerySchema = z.object({
  /** Defaults to the most recent COMPLETED run that has a realised day to score. */
  runId: text.optional(),
  sku: text.optional(),
  warehouse: text.optional(),
  /**
   * `horizon` groups by day-of-horizon, which is how forecast error is usually
   * read: a model that is accurate at day 1 and useless at day 14 has a very
   * different problem from one that is uniformly mediocre.
   */
  groupBy: z.enum(["overall", "sku", "warehouse", "horizon"]).default("overall"),
});

export type AccuracyQuery = z.infer<typeof accuracyQuerySchema>;
