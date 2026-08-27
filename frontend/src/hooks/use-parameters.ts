"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/config/query-keys";
import { STALE_TIME } from "@/config/constants";
import { useUiStore } from "@/store/ui.store";
import {
  listParameters,
  upsertParameters,
  type ParameterListParams,
} from "@/lib/api/parameters";

/**
 * The ten numbers the executor plans with, per product per DC. Follows the top bar.
 */
export function usePlanningParameters(params?: ParameterListParams) {
  const dc = useUiStore((state) => state.dc);
  const scoped: ParameterListParams = { ...params, ...(dc ? { warehouse: dc } : {}) };

  return useQuery({
    queryKey: queryKeys.parameters.list(scoped),
    queryFn: () => listParameters(scoped),
    staleTime: STALE_TIME.reference,
  });
}

/**
 * Writing a parameter changes what the next run plans with, so this invalidates the
 * planning group as well as its own - a stale safety stock on screen beside a changed
 * service level is the confusion this avoids.
 */
export function useUpsertParameters() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: upsertParameters,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.parameters.all });
      void client.invalidateQueries({ queryKey: queryKeys.planning.all });
    },
  });
}
