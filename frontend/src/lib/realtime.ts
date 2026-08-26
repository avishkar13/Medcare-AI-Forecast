"use client";

import { io, type Socket } from "socket.io-client";
import { env } from "@/config/env";

/**
 * The client half of the alert push channel.
 *
 * One socket per tab, shared by every subscriber. React Query still owns the data -
 * an event only says "something moved", and the provider invalidates so the existing
 * queries refetch through the same typed API layer. Nothing here writes to the cache
 * directly, so there is one shape of alert in the app rather than two.
 *
 * Connection is best-effort by design. `NEXT_PUBLIC_WS_URL` unset, a backend that is
 * down, or a proxy that will not upgrade all land in the same place: `connected`
 * stays false and the caller polls instead.
 */

export type AlertEventName =
  | "alert:created"
  | "alert:updated"
  | "alert:resolved"
  | "alert:counts";

export interface AlertCounts {
  unresolved: number;
  critical: number;
  high: number;
}

export interface RealtimeAlert {
  id: string;
  severity: string;
  type: string;
  title: string;
  sku: string | null;
  location: string;
  warehouseId: string | null;
  productId: string | null;
  recommendedAction: string;
}

let socket: Socket | null = null;

export const getSocket = (): Socket | null => {
  if (!env.wsUrl) return null;
  if (socket) return socket;

  socket = io(env.wsUrl, {
    path: "/socket.io",
    // websocket first, polling as the fallback the server also advertises.
    transports: ["websocket", "polling"],
    // Bounded: a backend that is genuinely absent should stop being retried rather
    // than reconnecting forever behind a page nobody is watching.
    reconnectionAttempts: 5,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
    timeout: 5_000,
    autoConnect: true,
  });

  return socket;
};

/** Narrows what the server pushes to this client to a single DC, or the whole network. */
export const setSocketScope = (warehouseId: string | null): void => {
  getSocket()?.emit("scope:set", warehouseId ?? "");
};

export const disconnectSocket = (): void => {
  socket?.disconnect();
  socket = null;
};
