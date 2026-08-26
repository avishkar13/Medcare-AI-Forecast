"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/config/query-keys";
import { STALE_TIME } from "@/config/constants";
import { getModelMetrics } from "@/lib/api/models";

export function useModelMetrics() {
  return useQuery({
    queryKey: queryKeys.models.metrics(),
    queryFn: getModelMetrics,
    staleTime: STALE_TIME.reference,
  });
}
