import { api } from "./client";

export interface ErrorMetrics {
  MAE: number;
  RMSE: number;
  MAPE_percent: number;
  sMAPE_percent: number;
  wMAPE_percent: number;
  bias_percent: number;
}

export interface ModelMetrics {
  training_rows: number;
  test_rows: number;
  unique_skus: number;
  unique_warehouses: number;
  baseline_7_day_moving_average: ErrorMetrics;
  xgboost: ErrorMetrics;
  quantile_forecasting: {
    P10_pinball: number;
    P50_pinball: number;
    P90_pinball: number;
    P10_P90_coverage_percent: number;
  };
  rolling_time_series_cv: { fold?: number; MAE: number; RMSE: number; wMAPE_percent?: number }[];
  selected_model_by_mae: string;
  calibration_ok: boolean;
  production_model: string;
  model_version: string;
  data_source: string;
}

export const getModelMetrics = () =>
  api.get<ModelMetrics>("/planning/models/metrics");
