import { z } from "zod";

/**
 * The model-metrics boundary. Follows `schemas/alerts.ts`.
 *
 * These names are snake_case because they come from the Python service verbatim -
 * Express proxies `/planning/models/metrics` without renaming. Mapping them to
 * camelCase here would put the rename in two places the moment the model changes.
 *
 * The whole payload is optional at the top level: `GET /planning/models/metrics`
 * answers 404 when no model has been trained, and a client that has never trained
 * one must not treat an absent metric as a zero score.
 */

export const errorMetricsSchema = z.object({
  MAE: z.number(),
  RMSE: z.number(),
  MAPE_percent: z.number(),
  sMAPE_percent: z.number(),
  wMAPE_percent: z.number(),
  bias_percent: z.number(),
});

export const modelMetricsSchema = z.object({
  training_rows: z.number(),
  test_rows: z.number(),
  unique_skus: z.number(),
  unique_warehouses: z.number(),
  baseline_7_day_moving_average: errorMetricsSchema,
  xgboost: errorMetricsSchema,
  quantile_forecasting: z.object({
    P10_pinball: z.number(),
    P50_pinball: z.number(),
    P90_pinball: z.number(),
    P10_P90_coverage_percent: z.number(),
  }),
  rolling_time_series_cv: z.array(
    z.object({
      fold: z.number().optional(),
      MAE: z.number(),
      RMSE: z.number(),
      wMAPE_percent: z.number().optional(),
    }),
  ),
  selected_model_by_mae: z.string(),
  calibration_ok: z.boolean(),
  production_model: z.string(),
  model_version: z.string(),
  data_source: z.string(),
});

export type ErrorMetrics = z.infer<typeof errorMetricsSchema>;
export type ModelMetrics = z.infer<typeof modelMetricsSchema>;
