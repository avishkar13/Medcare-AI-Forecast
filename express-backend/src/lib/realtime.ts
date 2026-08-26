import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { CORS } from "../config/constants.js";

/**
 * The push side of the alert surface.
 *
 * A detection cycle already reconciles the whole table; without this the browser only
 * learns about it on the next poll, so a condition raised at 10:32 surfaces whenever
 * react-query happens to refetch. This publishes it as it commits.
 *
 * Deliberately one-directional. Clients subscribe to a scope and receive; every
 * mutation still goes through the REST routes, so there is one write path and one set
 * of rate limits rather than two.
 *
 * `attachRealtime` is optional: the module holds a null server until it is called, and
 * every emit is a no-op until then. Tests and scripts import the services without
 * standing up a socket.
 */

const ALL_ROOM = "all";
const dcRoom = (warehouseId: string) => `dc:${warehouseId}`;

export type AlertEvent = "alert:created" | "alert:updated" | "alert:resolved" | "alert:counts";

let io: Server | null = null;

export const attachRealtime = (server: HttpServer): Server => {
  io = new Server(server, {
    path: "/socket.io",
    cors: { origin: CORS.origins, credentials: CORS.credentials },
    // Behind a proxy that cannot upgrade, long-polling still delivers. Listing both
    // lets the client negotiate down instead of failing closed.
    transports: ["websocket", "polling"],
    serveClient: false,
  });

  io.on("connection", (socket: Socket) => {
    socket.join(ALL_ROOM);

    // A client watching one DC should not be woken by every other DC's alerts.
    socket.on("scope:set", (warehouseId: unknown) => {
      for (const room of socket.rooms) {
        if (room.startsWith("dc:")) void socket.leave(room);
      }
      if (typeof warehouseId === "string" && warehouseId.length > 0) {
        void socket.join(dcRoom(warehouseId));
      }
    });
  });

  return io;
};

export const closeRealtime = async (): Promise<void> => {
  if (!io) return;
  const closing = io;
  io = null;
  await new Promise<void>((resolve) => closing.close(() => resolve()));
};

export const realtimeConnections = (): number => io?.engine.clientsCount ?? 0;

/**
 * Emitted to the network room and, when the payload is scoped, to that DC's room.
 *
 * A client in a DC room is also in `all`, so socket.io de-duplicates the delivery -
 * emitting to both is what makes an unscoped client see everything without a second
 * subscription.
 */
export const emitAlert = (event: AlertEvent, payload: unknown, warehouseId?: string | null): void => {
  if (!io) return;

  const rooms = warehouseId ? [ALL_ROOM, dcRoom(warehouseId)] : [ALL_ROOM];
  io.to(rooms).emit(event, payload);
};
