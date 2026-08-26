"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/config/query-keys";
import { STALE_TIME } from "@/config/constants";
import {
  acknowledgeAlert,
  getOverview,
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
