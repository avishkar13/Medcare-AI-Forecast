import { z } from "zod";

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");
const quantity = z.number().finite().nonnegative();

export const forecastPairSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
});

export const forecastRequestSchema = z.object({
  runId: z.string().min(1),
  horizonDays: z.number().int().min(1).max(365),
  asOf: isoDay,
  pairs: forecastPairSchema.array().min(1),
});

const forecastSeriesSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  start: isoDay,
  p10: quantity.array(),
  p50: quantity.array(),
  p90: quantity.array(),
});

export const forecastResponseSchema = z.object({
  modelVersion: z.string().trim().min(1).max(64),
  generatedAt: z.string().min(1),
  horizonDays: z.number().int().min(1).max(365),
  forecasts: forecastSeriesSchema.array(),
});

const holdoutScoreSchema = z.object({
  MAE: z.number().finite(),
  RMSE: z.number().finite(),
  wMAPE_percent: z.number().finite(),
  bias_percent: z.number().finite(),
});

/**
 * The engine's last fit, as served by `GET /model/metrics`.
 *
 * Only the fields `/forecast/performance` reports are declared; the file carries the
 * per-fold CV and pinball losses too, and a future field must not fail this parse.
 * Loose rather than strict for that reason.
 */
export const modelMetricsSchema = z.looseObject({
  model_version: z.string().min(1).optional(),
  test_rows: z.number().int().nonnegative().optional(),
  xgboost: holdoutScoreSchema,
  baseline_7_day_moving_average: holdoutScoreSchema.optional(),
});

export type ForecastPair = z.infer<typeof forecastPairSchema>;
export type ForecastRequest = z.infer<typeof forecastRequestSchema>;
export type ForecastResponse = z.infer<typeof forecastResponseSchema>;
export type ForecastSeries = z.infer<typeof forecastSeriesSchema>;
export type ModelMetrics = z.infer<typeof modelMetricsSchema>;

const pairKey = (pair: ForecastPair) => `${pair.productId}:${pair.warehouseId}`;

/**
 * Everything the wire schema cannot express: lengths against the requested horizon,
 * band ordering, the start date, and the pair set matching exactly.
 *
 * Returns the reasons a response is unusable. A partially-good forecast is not
 * salvaged - a wrong band poisons safety stock, and every artefact downstream of it.
 */
export const forecastViolations = (
  response: ForecastResponse,
  request: ForecastRequest,
  expectedStart: string,
): string[] => {
  const problems: string[] = [];

  if (response.horizonDays !== request.horizonDays) {
    problems.push(`horizonDays ${response.horizonDays} does not match the requested ${request.horizonDays}`);
  }

  const seen = new Set<string>();

  for (const series of response.forecasts) {
    const key = pairKey(series);

    if (seen.has(key)) problems.push(`duplicate forecast for ${key}`);
    seen.add(key);

    if (series.start !== expectedStart) {
      problems.push(`${key}: start ${series.start} is not asOf + 1 (${expectedStart})`);
    }

    for (const band of ["p10", "p50", "p90"] as const) {
      if (series[band].length !== request.horizonDays) {
        problems.push(`${key}: ${band} has ${series[band].length} values, expected ${request.horizonDays}`);
      }
    }

    const points = Math.min(series.p10.length, series.p50.length, series.p90.length);
    for (let index = 0; index < points; index += 1) {
      const low = series.p10[index]!;
      const mid = series.p50[index]!;
      const high = series.p90[index]!;
      if (!(low <= mid && mid <= high)) {
        problems.push(`${key}: band out of order at day ${index} (${low}, ${mid}, ${high})`);
        break;
      }
    }
  }

  const requested = new Set(request.pairs.map(pairKey));
  for (const key of requested) if (!seen.has(key)) problems.push(`missing forecast for ${key}`);
  for (const key of seen) if (!requested.has(key)) problems.push(`unrequested forecast for ${key}`);

  return problems;
};
