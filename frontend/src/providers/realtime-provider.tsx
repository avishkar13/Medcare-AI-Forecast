"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/config/query-keys";
import { useAuthStore } from "@/store/auth.store";
import {
  connectSocket,
  disconnectSocket,
  type AlertCounts,
  type RealtimeAlert,
} from "@/lib/realtime";

/**
 * Turns pushed alert events into cache invalidations and toasts.
 *
 * Events carry a payload, but it is used only for the toast copy and the badge - the
 * tables always refetch through the API layer. Rendering straight from a socket
 * payload would mean two shapes of alert in the app and a cache that silently
 * disagrees with the server after a dropped event.
 *
 * `isLive` is what the rest of the app reads to decide whether it still needs to
 * poll. Nothing here is required for the app to work: with no socket the value is
 * false and the alert queries fall back to an interval.
 */

interface RealtimeState {
  isLive: boolean;
  counts: AlertCounts | null;
}

const RealtimeContext = createContext<RealtimeState>({ isLive: false, counts: null });

export const useRealtime = () => useContext(RealtimeContext);

/** Only what would genuinely interrupt someone gets a toast; the rest updates quietly. */
const INTERRUPTS = new Set(["critical", "high"]);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  // Subscribed rather than read once: the socket has to be rebuilt on login and torn
  // down on logout, and its rooms were joined under whichever identity it opened with.
  const token = useAuthStore((state) => state.token);
  const [isLive, setIsLive] = useState(false);
  const [counts, setCounts] = useState<AlertCounts | null>(null);

  useEffect(() => {
    const socket = connectSocket(token);

    if (!socket) {
      setIsLive(false);
      setCounts(null);
      return;
    }

    const invalidate = () => void client.invalidateQueries({ queryKey: queryKeys.alerts.all });

    const onConnect = () => setIsLive(true);
    const onDisconnect = () => setIsLive(false);

    const onCreated = (alert: RealtimeAlert) => {
      invalidate();
      if (!INTERRUPTS.has(alert.severity)) return;

      toast(alert.title, {
        description: `${alert.location} — ${alert.recommendedAction}`,
        // The link is the whole point of pushing it: a toast that cannot be acted on
        // is just noise. Context travels so the page opens already scoped.
        action: {
          label: "View",
          onClick: () => {
            const params = new URLSearchParams();
            if (alert.warehouseId) params.set("dc", alert.warehouseId);
            if (alert.sku) params.set("sku", alert.sku);
            window.location.href = `/alerts?${params.toString()}`;
          },
        },
      });
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("alert:created", onCreated);
    socket.on("alert:updated", invalidate);
    socket.on("alert:resolved", invalidate);
    socket.on("alert:counts", setCounts);

    if (socket.connected) setIsLive(true);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("alert:created", onCreated);
      socket.off("alert:updated", invalidate);
      socket.off("alert:resolved", invalidate);
      socket.off("alert:counts", setCounts);
      // On logout the token becomes null and this effect re-runs with nothing to
      // connect to; close the socket rather than leaving it open under the old
      // identity, still in the rooms that identity was allowed to join.
      if (!useAuthStore.getState().token) disconnectSocket();
    };
  }, [client, token]);

  const value = useMemo(() => ({ isLive, counts }), [isLive, counts]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}
