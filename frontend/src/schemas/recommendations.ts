import { z } from "zod";

/**
 * The recommendations boundary. Follows `schemas/alerts.ts`.
 *
 * The hand-written interface this replaces was missing seven fields the backend
 * already sends - `productId`, `warehouseId`, `category`, `criticality`, `signals`,
 * `acknowledgedAt` and `resolvedAt`. `signals` is the one that mattered: the row
 * mapper hardcoded an empty array while the executor's cited signals were arriving on
 * every row.
 *
 * `priority` and `status` are enums here because they are Prisma enums on the backend
 * and the lifecycle in `recommendation.service.ts` is closed over exactly these values.
 */

export const recommendationPrioritySchema = z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);

export const recommendationStatusSchema = z.enum([
  "OPEN",
  "ACCEPTED",
  "REJECTED",
  "COMPLETED",
]);

export const recommendationSignalSchema = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string(),
  direction: z.string(),
});

export const recommendationSchema = z.object({
  id: z.string(),
  planningRunId: z.string(),
  type: z.string(),
  actionType: z.string().nullable(),
  priority: recommendationPrioritySchema,
  status: recommendationStatusSchema,
  message: z.string(),
  quantity: z.number().nullable(),
  // Null where the executor recorded nothing. A default would be a number a planner
  // could act on that no calculation ever produced.
  confidence: z.number().nullable(),
  expectedImpact: z.string().nullable(),
  impactValue: z.number().nullable(),
  productId: z.string(),
  sku: z.string(),
  productName: z.string(),
  category: z.string().nullable(),
  criticality: z.string(),
  warehouseId: z.string(),
  warehouseCode: z.string(),
  warehouseName: z.string(),
  tier: z.string(),
  signals: z.array(recommendationSignalSchema),
  acknowledgedAt: z.string().nullable(),
  resolvedAt: z.string().nullable(),
  actedById: z.string().nullable(),
  createdAt: z.string(),
});

export const recommendationKpiSchema = z.object({
  planningRunId: z.string().nullable(),
  totalRecommendations: z.number(),
  open: z.number(),
  accepted: z.number(),
  completed: z.number(),
  rejected: z.number(),
  // Null when no recommendation carried an impact figure - not zero, which would
  // read as "this run is worth nothing".
  potentialSavings: z.number().nullable(),
  // Null when there are no recommendations at all: a rate over zero rows is undefined.
  executionRatePercent: z.number().nullable(),
});

export const recommendationSummarySchema = z.object({
  planningRunId: z.string().nullable(),
  byType: z.array(
    z.object({ type: z.string(), count: z.number(), impactValue: z.number().nullable() }),
  ),
  byPriority: z.array(
    z.object({ priority: recommendationPrioritySchema, count: z.number() }),
  ),
  byStatus: z.array(z.object({ status: recommendationStatusSchema, count: z.number() })),
});

export const recommendationImpactSchema = z.object({
  planningRunId: z.string().nullable(),
  planCost: z
    .object({
      total: z.number(),
      holding: z.number(),
      stockout: z.number(),
      transfer: z.number(),
      expiry: z.number(),
    })
    .nullable(),
  attributedImpact: z.number(),
  byType: z.array(
    z.object({
      type: z.string(),
      count: z.number(),
      impactValue: z.number().nullable(),
      sharePercent: z.number().nullable(),
    }),
  ),
});

export const recommendationIntelligenceSchema = z.object({
  planningRunId: z.string().nullable(),
  modelVersion: z.string().nullable(),
  horizonDays: z.number().nullable(),
  recommendationCount: z.number(),
  averageConfidence: z.number().nullable(),
  signalsCited: z.array(z.object({ type: z.string(), count: z.number() })),
});

export type RecommendationPriority = z.infer<typeof recommendationPrioritySchema>;
export type RecommendationStatus = z.infer<typeof recommendationStatusSchema>;
export type RecommendationSignal = z.infer<typeof recommendationSignalSchema>;
export type Recommendation = z.infer<typeof recommendationSchema>;
export type RecommendationKpi = z.infer<typeof recommendationKpiSchema>;
export type RecommendationSummaryPayload = z.infer<typeof recommendationSummarySchema>;
export type RecommendationImpactPayload = z.infer<typeof recommendationImpactSchema>;
export type RecommendationIntelligencePayload = z.infer<
  typeof recommendationIntelligenceSchema
>;
