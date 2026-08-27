"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/config/query-keys";
import { STALE_TIME } from "@/config/constants";
import {
  createScenario,
  getScenario,
  listScenarios,
  type ScenarioListParams,
} from "@/lib/api/scenarios";

/**
 * Scenarios are network-wide by construction - a demand multiplier applies to the
 * whole network - so unlike every other list here they take no DC scope.
 */
export function useScenarios(params?: ScenarioListParams) {
  return useQuery({
    queryKey: queryKeys.scenarios.list(params),
    queryFn: () => listScenarios(params),
    staleTime: STALE_TIME.list,
  });
}

export function useScenario(id: string | null) {
  return useQuery({
    queryKey: queryKeys.scenarios.one(id ?? "none"),
    queryFn: () => getScenario(id!),
    enabled: Boolean(id),
    staleTime: STALE_TIME.list,
  });
}

export function useCreateScenario() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: createScenario,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.scenarios.all }),
  });
}
