import { z } from "zod";
import { RunStatus } from "../../generated/prisma/enums.js";

const identifier = z.string().trim().min(1);

export const createRunBodySchema = z.strictObject({
  scenarioId: identifier.optional(),
  horizonDays: z.number().int().min(1).max(365).default(30),
  modelVersion: z.string().trim().min(1).max(64).optional(),
});

export const runQuerySchema = z.object({
  status: z.enum(RunStatus).optional(),
  scenarioId: identifier.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const runParamsSchema = z.object({ id: identifier });

// Required, not defaulted to "the previous run": a comparison whose baseline moved
// on its own would change meaning between two identical requests.
export const compareQuerySchema = z.object({ baseline: identifier });

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(255)
  .regex(/^[\w.:-]+$/, "may contain only letters, digits, and . : _ -");

export type CreateRunBody = z.infer<typeof createRunBodySchema>;
export type RunQuery = z.infer<typeof runQuerySchema>;
export type RunParams = z.infer<typeof runParamsSchema>;
export type CompareQuery = z.infer<typeof compareQuerySchema>;
