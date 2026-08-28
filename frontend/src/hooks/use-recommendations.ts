"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/config/query-keys";
import { STALE_TIME } from "@/config/constants";
import { useUiStore } from "@/store/ui.store";
import {
  dismissRecommendation,
  executeRecommendation,
  getImpact,
  getIntelligence,
  getKpi,
  getSummary,
  listRecommendations,
  type RecommendationListParams,
} from "@/lib/api/recommendations";

/**
 * Every panel follows the DC selected in the top bar, for the same reason the
 * dashboard hooks do: threading `warehouse` through a dozen leaf components is how
 * one panel ends up network-wide beside three that are not. The DC is part of the
 * query key, so two scopes are two caches.
 */
const useScopedParams = (params?: RecommendationListParams): RecommendationListParams => {
  const dc = useUiStore((state) => state.dc);
  // The SKU travels too. Five links across the dashboard, alerts, expiry and inventory
  // build `/recommendations?sku=…` with `withScope`, and every one of them landed on
  // the unfiltered network list because this dropped it - the deep link changed the
  // URL and nothing else. It is part of the query key for the same reason `dc` is.
  const sku = useUiStore((state) => state.sku);
  return { ...params, ...(dc ? { warehouse: dc } : {}), ...(sku ? { sku } : {}) };
};

export function useRecommendations(params?: RecommendationListParams) {
  const scoped = useScopedParams(params);
  return useQuery({
    queryKey: queryKeys.recommendations.list(scoped),
    queryFn: () => listRecommendations(scoped),
    staleTime: STALE_TIME.list,
  });
}

export function useRecommendationImpact() {
  const scoped = useScopedParams();
  return useQuery({
    queryKey: queryKeys.recommendations.impact(scoped),
    queryFn: () => getImpact(scoped),
    staleTime: STALE_TIME.dashboard,
  });
}

export function useRecommendationIntelligence() {
  const scoped = useScopedParams();
  return useQuery({
    queryKey: queryKeys.recommendations.intelligence(scoped),
    queryFn: () => getIntelligence(scoped),
    staleTime: STALE_TIME.dashboard,
  });
}

// both transitions invalidate the whole group: the lists, the kpis and the impact
// totals all move when one row is resolved.
export function useRecommendationAction() {
  const client = useQueryClient();
  const settle = () =>
    client.invalidateQueries({ queryKey: queryKeys.recommendations.all });

  const execute = useMutation({ mutationFn: executeRecommendation, onSuccess: settle });
  const dismiss = useMutation({ mutationFn: dismissRecommendation, onSuccess: settle });

  return { execute, dismiss };
}

export function useRecommendationKpi() {
  const scoped = useScopedParams();
  return useQuery({
    queryKey: queryKeys.recommendations.kpi(scoped),
    queryFn: () => getKpi(scoped),
    staleTime: STALE_TIME.dashboard,
  });
}

export function useRecommendationSummary() {
  const scoped = useScopedParams();
  return useQuery({
    queryKey: queryKeys.recommendations.summary(scoped),
    queryFn: () => getSummary(scoped),
    staleTime: STALE_TIME.dashboard,
  });
}
