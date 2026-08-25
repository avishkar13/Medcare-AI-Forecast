import { z } from "zod";

const text = z.string().trim().min(1);

export const trainingDataQuerySchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    sku: text.optional(),
    warehouse: text.optional(),
  })
  .refine((query) => query.from === undefined || query.to === undefined || query.from <= query.to, {
    message: "'from' must not be after 'to'",
    path: ["from"],
  });

export type TrainingDataQuery = z.infer<typeof trainingDataQuerySchema>;
