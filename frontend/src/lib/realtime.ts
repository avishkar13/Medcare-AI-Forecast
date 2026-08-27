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
 * Connection is best-effort by design. `NEXT_PUBLIC_WS_URL` unset, no token yet, a
 * backend that is down, or a proxy that will not upgrade all land in the same place:
 * `connected` stays false and the caller polls instead.
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
/** What the live socket was built with, so a token change can be detected. */
let connectedToken: string | null = null;

/**
 * Opens the socket for this token, reusing the existing one when nothing changed.
 *
 * The token goes in the handshake rather than a header because a WebSocket upgrade
 * carries no custom headers - `auth` is the payload the server reads in `io.use()`.
 *
 * A different token means a different user, so the old socket is torn down rather
 * than reused: its rooms were joined under the previous identity and could be wider
 * than the new one is allowed to see.
 */
export const connectSocket = (token: string | null): Socket | null => {
  if (!env.wsUrl || !token) {
    disconnectSocket();
    return null;
  }

  if (socket && connectedToken === token) return socket;

  disconnectSocket();
  connectedToken = token;

  socket = io(env.wsUrl, {
    path: "/socket.io",
    auth: { token },
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

  /**
   * A rejected handshake is not a transient fault - the same token will be refused
   * every time. Retrying it just burns connections until the attempt cap, so stop.
   * The app falls back to polling, and a fresh login builds a new socket.
   */
  socket.on("connect_error", (error) => {
    const message = error.message ?? "";
    const isAuthFailure =
      message.includes("authentication") ||
      message.includes("token") ||
      message.includes("user");

    if (isAuthFailure) {
      console.warn("realtime handshake rejected:", message);
      socket?.disconnect();
    }
  });

  return socket;
};

export const getSocket = (): Socket | null => socket;

/** Narrows what the server pushes to this client to a single DC, or the whole network. */
export const setSocketScope = (warehouseId: string | null): void => {
  socket?.emit("scope:set", warehouseId ?? "");
};

export const disconnectSocket = (): void => {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  connectedToken = null;
};
