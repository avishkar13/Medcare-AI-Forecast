"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/config/query-keys";
import { getReadiness } from "@/lib/api/health";

export function useReadiness() {
  return useQuery({
    queryKey: queryKeys.health.readiness(),
    queryFn: getReadiness,
    // a dependency can drop at any time, so this one is worth re-checking
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}
