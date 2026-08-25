import { z } from "zod";
import { Priority, RecommendationStatus, RecommendationType } from "../../generated/prisma/enums.js";

const text = z.string().trim().min(1);

export const recommendationQuerySchema = z.object({
  /** Defaults to the most recent COMPLETED run. */
  runId: text.optional(),
  status: z.enum(RecommendationStatus).optional(),
  priority: z.enum(Priority).optional(),
  type: z.enum(RecommendationType).optional(),
  /** Warehouse cuid or `code`. */
  warehouse: text.optional(),
  /** Product cuid or `sku`. */
  sku: text.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const recommendationParamsSchema = z.object({ id: text });

/**
 * The lifecycle is a state machine, so the transition is named rather than the
 * target status being posted directly - a client cannot ask for OPEN -> OPEN, or
 * walk a resolved row back to open by writing whatever it likes.
 */
export const recommendationActionSchema = z.strictObject({
  note: text.max(500).optional(),
});

export type RecommendationQuery = z.infer<typeof recommendationQuerySchema>;
export type RecommendationParams = z.infer<typeof recommendationParamsSchema>;
export type RecommendationAction = z.infer<typeof recommendationActionSchema>;
