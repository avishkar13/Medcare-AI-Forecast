"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/config/query-keys";
import { STALE_TIME } from "@/config/constants";
import { useRealtime } from "@/providers/realtime-provider";
import {
  acknowledgeAlert,
  getDistribution,
  getHealth,
  getOverview,
  getTrends,
  listAlerts,
  listDeliveries,
  markAllRead,
  refreshAlerts,
  resolveAlert,
  sendTestNotification,
  type AlertListParams,
} from "@/lib/api/alerts";
import { useUiStore } from "@/store/ui.store";

/**
 * When the socket is connected the server tells us what changed, so an interval on
 * top of it is pure duplicate traffic. When it is not - no `NEXT_PUBLIC_WS_URL`, a
 * proxy that will not upgrade, a backend that is down - the interval is the only
 * thing keeping the page current.
 */
const usePollInterval = (): number | false => {
  const { isLive } = useRealtime();
  return isLive ? false : 30_000;
};

export function useAlerts(params?: AlertListParams) {
  const refetchInterval = usePollInterval();

  return useQuery({
    queryKey: queryKeys.alerts.list(params),
    queryFn: () => listAlerts(params),
    staleTime: STALE_TIME.list,
    refetchInterval,
    // Filtering is a server round trip now, so keep the previous page on screen
    // rather than flashing an empty table between requests.
    placeholderData: (previous) => previous,
  });
}

export function useAlertOverview() {
  const refetchInterval = usePollInterval();
  /**
   * The KPI strip follows the DC like the list does.
   *
   * It did not, and the summary routes ignored the query anyway, so a DC-scoped page
   * showed 9 critical and 38 unresolved above a list of 8 alerts of which 5 were
   * critical - the header contradicting the table directly beneath it.
   */
  const dc = useUiStore((state) => state.dc);

  return useQuery({
    queryKey: queryKeys.alerts.overview(dc),
    queryFn: () => getOverview(dc),
    staleTime: STALE_TIME.dashboard,
    refetchInterval,
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

/**
 * Detection on demand.
 *
 * The outcome is worth reporting rather than swallowing: "nothing changed" and "12
 * new conditions" look identical on a table that refetched, and only one of them
 * means the button did something.
 */
export function useRefreshAlerts() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: refreshAlerts,
    onSuccess: (outcome) => {
      void client.invalidateQueries({ queryKey: queryKeys.alerts.all });

      if (outcome.skipped) {
        toast.warning("Detection is switched off", {
          description: "Real-time monitoring is disabled in Settings → Alerts.",
        });
        return;
      }

      const parts = [
        outcome.created > 0 ? `${outcome.created} new` : null,
        outcome.resolved > 0 ? `${outcome.resolved} resolved` : null,
        outcome.notified > 0 ? `${outcome.notified} notifications sent` : null,
      ].filter(Boolean);

      toast.success(`Checked ${outcome.detected} conditions`, {
        description: parts.length > 0 ? parts.join(" · ") : "Nothing changed.",
      });
    },
    onError: () => toast.error("Could not run detection"),
  });
}

export function useNotificationDeliveries(params?: { channel?: string; pageSize?: number }) {
  return useQuery({
    queryKey: queryKeys.alerts.deliveries(params),
    queryFn: () => listDeliveries(params),
    staleTime: STALE_TIME.list,
  });
}

export function useTestNotification() {
  return useMutation({
    mutationFn: sendTestNotification,
    onSuccess: ({ results }) => {
      const sent = results.filter((result) => result.status === "SENT");
      const failed = results.filter((result) => result.status === "FAILED");

      if (failed.length > 0) {
        toast.error(`${failed.length} channel${failed.length === 1 ? "" : "s"} failed`, {
          description: failed.map((result) => `${result.channel}: ${result.error}`).join(" · "),
        });
        return;
      }

      toast.success(
        sent.length > 0
          ? `Sent on ${sent.map((result) => result.channel).join(", ")}`
          : "Every channel is disabled or unconfigured",
      );
    },
    onError: () => toast.error("Could not send the test notification"),
  });
}

export function useAlertDistribution() {
  const dc = useUiStore((state) => state.dc);
  return useQuery({
    queryKey: queryKeys.alerts.distribution(dc),
    queryFn: () => getDistribution(dc),
    staleTime: STALE_TIME.dashboard,
  });
}

export function useAlertTrends(days = 14) {
  const dc = useUiStore((state) => state.dc);
  return useQuery({
    queryKey: queryKeys.alerts.trends({ days, dc: dc ?? "all" }),
    queryFn: () => getTrends(days, dc),
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
