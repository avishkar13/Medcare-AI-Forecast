"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/config/query-keys";
import { STALE_TIME } from "@/config/constants";
import { useUiStore } from "@/store/ui.store";
import {
  getExpiryRisk,
  getNetwork,
  getPriorityActions,
  getSummary,
} from "@/lib/api/dashboard";

/**
 * These queries refresh on their own.
 *
 * Another planner's movement changes these figures, and the socket carries alert events
 * only - so a movement that raises nothing would otherwise sit unseen until the page was
 * touched. `LIVE` is applied to every query below rather than repeated per hook.
 */
const LIVE = { refetchInterval: 30_000, refetchOnWindowFocus: true } as const;

/**
 * Every dashboard panel follows the DC selected in the top bar.
 *
 * The scope is read from the store rather than taken as a prop: these hooks are
 * called from a dozen leaf components, and threading `warehouseId` through all of
 * them is how one panel ends up network-wide beside three that are not.
 *
 * The DC is part of every query key, so two scopes are two caches - without that,
 * switching DC would show the previous DC's numbers until the refetch landed.
 */
const useDc = () => useUiStore((state) => state.dc);

const scopeOf = (dc?: string) => (dc ? { warehouseId: dc } : undefined);

export function useDashboardSummary() {
  const dc = useDc();
  return useQuery({
    queryKey: queryKeys.dashboard.summary(dc),
    queryFn: () => getSummary(scopeOf(dc)),
    staleTime: STALE_TIME.dashboard,
    ...LIVE,
  });
}

export function useDashboardNetwork() {
  const dc = useDc();
  return useQuery({
    queryKey: queryKeys.dashboard.network(dc),
    queryFn: () => getNetwork(scopeOf(dc)),
    staleTime: STALE_TIME.dashboard,
    ...LIVE,
  });
}

export function useDashboardPriorityActions() {
  const dc = useDc();
  return useQuery({
    queryKey: queryKeys.dashboard.priorityActions(dc),
    queryFn: () => getPriorityActions(scopeOf(dc)),
    staleTime: STALE_TIME.dashboard,
    ...LIVE,
  });
}

export function useDashboardExpiryRisk() {
  const dc = useDc();
  return useQuery({
    queryKey: queryKeys.dashboard.expiryRisk(dc),
    queryFn: () => getExpiryRisk(scopeOf(dc)),
    staleTime: STALE_TIME.dashboard,
    ...LIVE,
  });
}
