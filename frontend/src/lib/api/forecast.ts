import { api } from "./client";

export interface ForecastChart {
  planningRunId: string | null;
  modelVersion: string | null;
  history: { date: string; actualDemand: number }[];
  prediction: {
    date: string;
    predictedDemand: number;
    lowerBound: number;
    upperBound: number;
  }[];
}

export interface ForecastAccuracy {
  planningRunId: string | null;
  overall: {
    scoredPoints: number;
    accuracyPercent: number | null;
    wapePercent: number | null;
  };
  note: string | null;
}

export const getMainChart = (params?: {
  sku?: string;
  warehouse?: string;
  days?: number;
  historyDays?: number;
}) => api.get<ForecastChart>("/forecast/main-chart", params);

export const getAccuracy = (params?: { sku?: string; warehouse?: string }) =>
  api.get<ForecastAccuracy>("/forecast/accuracy", params);
