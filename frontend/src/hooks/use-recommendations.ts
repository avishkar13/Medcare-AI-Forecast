"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/config/query-keys";
import { STALE_TIME } from "@/config/constants";
import {
  dismissRecommendation,
  executeRecommendation,
  getImpact,
  getIntelligence,
  listRecommendations,
} from "@/lib/api/recommendations";

export function useRecommendations(params?: { pageSize?: number; status?: string }) {
  return useQuery({
    queryKey: queryKeys.recommendations.list(params),
    queryFn: () => listRecommendations(params),
    staleTime: STALE_TIME.list,
  });
}

export function useRecommendationImpact() {
  return useQuery({
    queryKey: queryKeys.recommendations.impact(),
    queryFn: getImpact,
    staleTime: STALE_TIME.dashboard,
  });
}

export function useRecommendationIntelligence() {
  return useQuery({
    queryKey: queryKeys.recommendations.intelligence(),
    queryFn: getIntelligence,
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
