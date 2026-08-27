import { z } from "zod";

/**
 * The forecast boundary. Follows `schemas/alerts.ts`.
 *
 * These schemas parse what the client consumes and let zod strip the rest -
 * `/forecast/accuracy` also returns `groupBy`, `groups`, `horizonDays` and
 * `dataCaveat` that no component reads today, and declaring them here would mean
 * maintaining a second copy of a shape nothing uses.
 *
 * Almost every figure is nullable because almost every figure is unmeasurable until a
 * planning run has completed and a forecast day has elapsed. `planningRunId: null` is
 * the backend saying no run has produced this yet - the client must render that as
 * absent, never as zero.
 */

const scopeFields = {
  planningRunId: z.string().nullable(),
  modelVersion: z.string().nullable(),
};

export const forecastScopeSchema = z.object(scopeFields);

export const forecastChartSchema = z.object({
  ...scopeFields,
  history: z.array(z.object({ date: z.string(), actualDemand: z.number() })),
  prediction: z.array(
    z.object({
      date: z.string(),
      predictedDemand: z.number(),
      lowerBound: z.number(),
      upperBound: z.number(),
    }),
  ),
});

export const forecastAccuracySchema = z.object({
  planningRunId: z.string().nullable(),
  overall: z.object({
    scoredPoints: z.number(),
    accuracyPercent: z.number().nullable(),
    wapePercent: z.number().nullable(),
  }),
  note: z.string().nullable(),
});

export const forecastKpiSchema = z.object({
  ...scopeFields,
  forecastedDemand: z.number().nullable(),
  forecastHorizonDays: z.number().nullable(),
  expectedPeakDemand: z.number().nullable(),
  peakDate: z.string().nullable(),
  averageDailyDemand: z.number().nullable(),
  forecastAccuracy: z.number().nullable(),
});

export const forecastSummarySchema = z.object({
  ...scopeFields,
  averageDailyDemand: z.number().nullable(),
  minExpectedDemand: z.number().nullable(),
  maxExpectedDemand: z.number().nullable(),
  confidenceRange: z.tuple([z.number(), z.number()]).nullable(),
  expectedTrend: z.string().nullable(),
  trendChangePercent: z.number().optional(),
});

export const forecastTrendSchema = z.object({
  ...scopeFields,
  sevenDayTrend: z.number().nullable(),
  thirtyDayTrend: z.number().nullable(),
  relativeBandWidth: z.number().nullable(),
  demandVolatility: z.string().nullable(),
});

export const seasonalityEntrySchema = z.object({
  label: z.union([z.string(), z.number()]),
  averageDemand: z.number(),
  index: z.number(),
  indexPercent: z.number(),
});

export const forecastSeasonalitySchema = z.object({
  ...scopeFields,
  weeklyPattern: z.array(seasonalityEntrySchema),
  monthlyPattern: z.array(seasonalityEntrySchema),
  seasonalUpliftPercent: z.number().nullable(),
});

export const forecastNetworkItemSchema = z.object({
  warehouseId: z.string(),
  code: z.string(),
  name: z.string(),
  tier: z.string(),
  region: z.string().nullable(),
  forecastDemand: z.number().nullable(),
  forecastDays: z.number(),
  recentDemand30d: z.number().nullable(),
  growthPercent: z.number().nullable(),
});

export const forecastNetworkSchema = z.object({
  ...scopeFields,
  items: z.array(forecastNetworkItemSchema),
});

export const forecastSkuItemSchema = z.object({
  productId: z.string(),
  sku: z.string(),
  name: z.string(),
  // `forecastread.service.ts` writes `product?.category ?? null`.
  category: z.string().nullable(),
  criticality: z.string(),
  forecastDemand: z.number(),
  forecastDays: z.number(),
  averageDailyDemand: z.number().nullable(),
});

export const forecastSkusSchema = z.object({
  ...scopeFields,
  items: z.array(forecastSkuItemSchema),
});

export const forecastPerformanceSchema = z.object({
  ...scopeFields,
  models: z.array(
    z.object({
      modelVersion: z.string().nullable(),
      isPrimary: z.boolean(),
      scoredPoints: z.number(),
      accuracyPercent: z.number().nullable(),
      wapePercent: z.number().nullable(),
      mae: z.number().nullable(),
      rmse: z.number().nullable(),
    }),
  ),
  note: z.string().nullable(),
});

export const forecastImpactSchema = z.object({
  ...scopeFields,
  totalCost: z.number().nullable(),
  holdingCost: z.number().nullable(),
  stockoutCost: z.number().nullable(),
  transferCost: z.number().nullable(),
  expiryCost: z.number().nullable(),
  expectedWaste: z.number().nullable(),
  serviceLevel: z.number().nullable(),
  serviceLevelPercent: z.number().nullable(),
});

export const forecastInsightSchema = z.object({
  ...scopeFields,
  observations: z.array(z.object({ kind: z.string(), detail: z.string() })),
});

export type ForecastScope = z.infer<typeof forecastScopeSchema>;
export type ForecastChart = z.infer<typeof forecastChartSchema>;
export type ForecastAccuracy = z.infer<typeof forecastAccuracySchema>;
export type ForecastKpi = z.infer<typeof forecastKpiSchema>;
export type ForecastSummary = z.infer<typeof forecastSummarySchema>;
export type ForecastTrend = z.infer<typeof forecastTrendSchema>;
export type SeasonalityEntry = z.infer<typeof seasonalityEntrySchema>;
export type ForecastSeasonality = z.infer<typeof forecastSeasonalitySchema>;
export type ForecastNetworkItem = z.infer<typeof forecastNetworkItemSchema>;
export type ForecastSkuItem = z.infer<typeof forecastSkuItemSchema>;
export type ForecastPerformance = z.infer<typeof forecastPerformanceSchema>;
export type ForecastImpact = z.infer<typeof forecastImpactSchema>;
export type ForecastInsight = z.infer<typeof forecastInsightSchema>;
