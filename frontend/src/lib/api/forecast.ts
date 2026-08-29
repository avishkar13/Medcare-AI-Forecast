import { api } from "./client";
import type { QueryParams } from "./types";
import {
  forecastAccuracySchema,
  forecastChartSchema,
  forecastImpactSchema,
  forecastInsightSchema,
  forecastKpiSchema,
  forecastNetworkSchema,
  forecastPerformanceSchema,
  forecastSeasonalitySchema,
  forecastSkusSchema,
  forecastSummarySchema,
  forecastTrendSchema,
} from "@/schemas/forecast";

export type {
  ForecastAccuracy,
  ForecastChart,
  ForecastImpact,
  ForecastInsight,
  ForecastKpi,
  ForecastNetworkItem,
  ForecastPerformance,
  ForecastScope,
  ForecastSeasonality,
  ForecastSkuItem,
  ForecastSummary,
  ForecastTrend,
  SeasonalityEntry,
} from "@/schemas/forecast";

/**
 * `warehouse` accepts an id or a code, so the id the DC selector holds goes straight
 * in with no lookup.
 */
export interface ForecastParams extends QueryParams {
  sku?: string;
  warehouse?: string;
  category?: string;
  days?: number;
  historyDays?: number;
}

export const getMainChart = async (params?: ForecastParams) =>
  forecastChartSchema.parse(await api.get<unknown>("/forecast/main-chart", params));

export const getAccuracy = async (params?: ForecastParams) =>
  forecastAccuracySchema.parse(await api.get<unknown>("/forecast/accuracy", params));

export const getKpi = async (params?: ForecastParams) =>
  forecastKpiSchema.parse(await api.get<unknown>("/forecast/kpi", params));

export const getSummary = async (params?: ForecastParams) =>
  forecastSummarySchema.parse(await api.get<unknown>("/forecast/summary", params));

export const getTrend = async (params?: ForecastParams) =>
  forecastTrendSchema.parse(await api.get<unknown>("/forecast/trend", params));

export const getSeasonality = async (params?: ForecastParams) =>
  forecastSeasonalitySchema.parse(await api.get<unknown>("/forecast/seasonality", params));

export const getNetwork = async (params?: ForecastParams) =>
  forecastNetworkSchema.parse(await api.get<unknown>("/forecast/network", params));

export const getSkus = async (params?: ForecastParams) =>
  forecastSkusSchema.parse(await api.get<unknown>("/forecast/skus", params));

export const getPerformance = async (params?: ForecastParams) =>
  forecastPerformanceSchema.parse(await api.get<unknown>("/forecast/performance", params));

export const getImpact = async (params?: ForecastParams) =>
  forecastImpactSchema.parse(await api.get<unknown>("/forecast/impact", params));

export const getInsight = async (params?: ForecastParams) =>
  forecastInsightSchema.parse(await api.get<unknown>("/forecast/insight", params));
