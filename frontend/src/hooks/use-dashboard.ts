"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/config/query-keys";
import { STALE_TIME } from "@/config/constants";
import {
  getExpiryRisk,
  getNetwork,
  getPriorityActions,
  getSummary,
} from "@/lib/api/dashboard";

export function useDashboardSummary() {
  return useQuery({
    queryKey: queryKeys.dashboard.summary(),
    queryFn: getSummary,
    staleTime: STALE_TIME.dashboard,
  });
}

export function useDashboardNetwork() {
  return useQuery({
    queryKey: queryKeys.dashboard.network(),
    queryFn: getNetwork,
    staleTime: STALE_TIME.dashboard,
  });
}

export function useDashboardPriorityActions() {
  return useQuery({
    queryKey: queryKeys.dashboard.priorityActions(),
    queryFn: getPriorityActions,
    staleTime: STALE_TIME.dashboard,
  });
}

export function useDashboardExpiryRisk() {
  return useQuery({
    queryKey: queryKeys.dashboard.expiryRisk(),
    queryFn: getExpiryRisk,
    staleTime: STALE_TIME.dashboard,
  });
}
