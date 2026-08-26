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

export interface ForecastScope {
  planningRunId: string | null;
  modelVersion: string | null;
}

export interface ForecastKpi extends ForecastScope {
  forecastedDemand: number | null;
  forecastHorizonDays: number | null;
  expectedPeakDemand: number | null;
  peakDate: string | null;
  averageDailyDemand: number | null;
  forecastAccuracy: number | null;
}

export interface ForecastSummary extends ForecastScope {
  averageDailyDemand: number | null;
  minExpectedDemand: number | null;
  maxExpectedDemand: number | null;
  confidenceRange: [number, number] | null;
  expectedTrend: string | null;
  trendChangePercent?: number;
}

export interface ForecastTrend extends ForecastScope {
  sevenDayTrend: number | null;
  thirtyDayTrend: number | null;
  relativeBandWidth: number | null;
  demandVolatility: string | null;
}

export interface SeasonalityEntry {
  label: string | number;
  averageDemand: number;
  index: number;
  indexPercent: number;
}

export interface ForecastSeasonality extends ForecastScope {
  weeklyPattern: SeasonalityEntry[];
  monthlyPattern: SeasonalityEntry[];
  seasonalUpliftPercent: number | null;
}

export interface ForecastNetworkItem {
  warehouseId: string;
  code: string;
  name: string;
  tier: string;
  region: string | null;
  forecastDemand: number | null;
  forecastDays: number;
  recentDemand30d: number | null;
  growthPercent: number | null;
}

export interface ForecastSkuItem {
  productId: string;
  sku: string;
  name: string;
  category: string;
  criticality: string;
  forecastDemand: number;
  forecastDays: number;
  averageDailyDemand: number | null;
}

export interface ForecastPerformance extends ForecastScope {
  models: {
    modelVersion: string | null;
    isPrimary: boolean;
    scoredPoints: number;
    accuracyPercent: number | null;
    wapePercent: number | null;
    mae: number | null;
    rmse: number | null;
  }[];
  note: string | null;
}

export interface ForecastImpact extends ForecastScope {
  totalCost: number | null;
  holdingCost: number | null;
  stockoutCost: number | null;
  transferCost: number | null;
  expiryCost: number | null;
  expectedWaste: number | null;
  serviceLevel: number | null;
  serviceLevelPercent: number | null;
}

export interface ForecastInsight extends ForecastScope {
  observations: { kind: string; detail: string }[];
}

type Scoped = { sku?: string; warehouse?: string; days?: number };

export const getKpi = (p?: Scoped) => api.get<ForecastKpi>("/forecast/kpi", p);
export const getSummary = (p?: Scoped) => api.get<ForecastSummary>("/forecast/summary", p);
export const getTrend = (p?: Scoped) => api.get<ForecastTrend>("/forecast/trend", p);
export const getSeasonality = (p?: Scoped) =>
  api.get<ForecastSeasonality>("/forecast/seasonality", p);
export const getNetwork = (p?: Scoped) =>
  api.get<{ items: ForecastNetworkItem[] } & ForecastScope>("/forecast/network", p);
export const getSkus = (p?: Scoped) =>
  api.get<{ items: ForecastSkuItem[] } & ForecastScope>("/forecast/skus", p);
export const getPerformance = (p?: Scoped) =>
  api.get<ForecastPerformance>("/forecast/performance", p);
export const getImpact = (p?: Scoped) => api.get<ForecastImpact>("/forecast/impact", p);
export const getInsight = (p?: Scoped) => api.get<ForecastInsight>("/forecast/insight", p);
