"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/config/query-keys";
import { STALE_TIME } from "@/config/constants";
import {
  getAccuracy,
  getImpact,
  getInsight,
  getKpi,
  getMainChart,
  getNetwork,
  getPerformance,
  getSeasonality,
  getSkus,
  getSummary,
  getTrend,
} from "@/lib/api/forecast";

export function useForecastChart(params?: {
  sku?: string;
  warehouse?: string;
  days?: number;
  historyDays?: number;
}) {
  return useQuery({
    queryKey: queryKeys.forecast.mainChart(params),
    queryFn: () => getMainChart(params),
    staleTime: STALE_TIME.dashboard,
  });
}

export function useForecastAccuracy(params?: { sku?: string; warehouse?: string }) {
  return useQuery({
    queryKey: queryKeys.forecast.accuracy(params),
    queryFn: () => getAccuracy(params),
    staleTime: STALE_TIME.dashboard,
  });
}

type Scoped = { sku?: string; warehouse?: string; days?: number };

// every panel on the page reads the same run, so they share a stale time and the
// scope object is passed straight through as the key.
const scoped = <T,>(
  key: readonly unknown[],
  fn: () => Promise<T>,
) => ({ queryKey: key, queryFn: fn, staleTime: STALE_TIME.dashboard });

export function useForecastKpi(p?: Scoped) {
  return useQuery(scoped(queryKeys.forecast.kpi(p), () => getKpi(p)));
}

export function useForecastSummary(p?: Scoped) {
  return useQuery(scoped(queryKeys.forecast.summary(p), () => getSummary(p)));
}

export function useForecastTrend(p?: Scoped) {
  return useQuery(scoped(queryKeys.forecast.trend(p), () => getTrend(p)));
}

export function useForecastSeasonality(p?: Scoped) {
  return useQuery(scoped(queryKeys.forecast.seasonality(p), () => getSeasonality(p)));
}

export function useForecastNetwork(p?: Scoped) {
  return useQuery(scoped(queryKeys.forecast.network(p), () => getNetwork(p)));
}

export function useForecastSkus(p?: Scoped) {
  return useQuery(scoped(queryKeys.forecast.skus(p), () => getSkus(p)));
}

export function useForecastPerformance(p?: Scoped) {
  return useQuery(scoped(queryKeys.forecast.performance(p), () => getPerformance(p)));
}

export function useForecastImpact(p?: Scoped) {
  return useQuery(scoped(queryKeys.forecast.impact(p), () => getImpact(p)));
}

export function useForecastInsight(p?: Scoped) {
  return useQuery(scoped(queryKeys.forecast.insight(p), () => getInsight(p)));
}
