"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/config/query-keys";
import { STALE_TIME } from "@/config/constants";
import {
  acknowledgeAlert,
  getDistribution,
  getHealth,
  getOverview,
  getTrends,
  listAlerts,
  markAllRead,
  resolveAlert,
} from "@/lib/api/alerts";

export function useAlerts(params?: { pageSize?: number; status?: string }) {
  return useQuery({
    queryKey: queryKeys.alerts.list(params),
    queryFn: () => listAlerts(params),
    staleTime: STALE_TIME.list,
  });
}

export function useAlertOverview() {
  return useQuery({
    queryKey: queryKeys.alerts.overview(),
    queryFn: getOverview,
    staleTime: STALE_TIME.dashboard,
  });
}

export function useAlertActions() {
  const client = useQueryClient();
  const settle = () => client.invalidateQueries({ queryKey: queryKeys.alerts.all });

  return {
    acknowledge: useMutation({ mutationFn: acknowledgeAlert, onSuccess: settle }),
    resolve: useMutation({ mutationFn: resolveAlert, onSuccess: settle }),
    markAllRead: useMutation({ mutationFn: markAllRead, onSuccess: settle }),
  };
}

export function useAlertDistribution() {
  return useQuery({
    queryKey: queryKeys.alerts.distribution(),
    queryFn: getDistribution,
    staleTime: STALE_TIME.dashboard,
  });
}

export function useAlertTrends(days = 14) {
  return useQuery({
    queryKey: queryKeys.alerts.trends({ days }),
    queryFn: () => getTrends(days),
    staleTime: STALE_TIME.dashboard,
  });
}

export function useAlertHealth() {
  return useQuery({
    queryKey: queryKeys.alerts.health(),
    queryFn: getHealth,
    staleTime: STALE_TIME.dashboard,
  });
}
