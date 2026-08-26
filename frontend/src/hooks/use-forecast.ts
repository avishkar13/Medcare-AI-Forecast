"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/config/query-keys";
import { STALE_TIME } from "@/config/constants";
import { getAccuracy, getMainChart } from "@/lib/api/forecast";

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
