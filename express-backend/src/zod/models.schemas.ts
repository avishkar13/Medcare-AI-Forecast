import { z } from "zod";

export const trainBodySchema = z.strictObject({
  /** Label for the fitted model, written to `Forecast.modelVersion` by later runs. */
  modelVersion: z.string().trim().min(1).max(100).optional(),
});

export type TrainBody = z.infer<typeof trainBodySchema>;
