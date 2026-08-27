import type { Server as HttpServer } from "node:http";
import jwt from "jsonwebtoken";
import { Server, type Socket } from "socket.io";
import { CORS } from "../config/constants.js";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";

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

interface SocketUser {
  id: string;
  /** null means network-wide access; a value confines this socket to one DC. */
  warehouseId: string | null;
}

let io: Server | null = null;

/**
 * The handshake gate.
 *
 * Alert payloads carry SKU, location and business impact, so an unauthenticated
 * socket is a read path around the API's auth - the REST routes sit behind
 * `authenticate` and this must not be the way round them.
 *
 * The user is re-read from the database rather than trusted from the token: a
 * deactivated account or a DC reassignment has to take effect on the next connection,
 * not whenever a week-old JWT happens to expire. This mirrors `middleware/scopeDc.ts`,
 * which re-reads `warehouseId` for the same reason.
 */
const authenticateSocket = async (socket: Socket): Promise<SocketUser> => {
  const raw: unknown = socket.handshake.auth?.token;
  const token = typeof raw === "string" && raw.length > 0 ? raw : null;
  if (!token) throw new Error("authentication required");

  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw new Error("invalid or expired token");
  }

  if (typeof payload === "string" || !payload.sub) throw new Error("invalid token payload");

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, warehouseId: true, isActive: true },
  });

  if (!user) throw new Error("user no longer exists");
  if (!user.isActive) throw new Error("user account is deactivated");

  return { id: user.id, warehouseId: user.warehouseId };
};

export const attachRealtime = (server: HttpServer): Server => {
  io = new Server(server, {
    path: "/socket.io",
    cors: { origin: CORS.origins, credentials: CORS.credentials },
    // Behind a proxy that cannot upgrade, long-polling still delivers. Listing both
    // lets the client negotiate down instead of failing closed.
    transports: ["websocket", "polling"],
    serveClient: false,
  });

  io.use((socket, next) => {
    authenticateSocket(socket)
      .then((user) => {
        socket.data.user = user;
        next();
      })
      // The message reaches the client as `connect_error`, which is what tells it to
      // stop retrying rather than hammer the handshake with a token that will not work.
      .catch((error: Error) => next(error));
  });

  io.on("connection", (socket: Socket) => {
    const user = socket.data.user as SocketUser;

    if (user.warehouseId === null) {
      // Network-wide: everything, until the client narrows itself for filtering.
      socket.join(ALL_ROOM);
    } else {
      // Confined to one DC. Deliberately *not* in `all` - that room carries every
      // other DC's alerts, and joining it would hand this user the whole network.
      socket.join(dcRoom(user.warehouseId));
    }

    /**
     * Narrows a network-wide client to one DC so it is not woken by the rest.
     *
     * Only meaningful for a user who can see everything; a DC-confined socket ignores
     * it, because honouring it would either be a no-op or an escalation.
     */
    socket.on("scope:set", (warehouseId: unknown) => {
      if (user.warehouseId !== null) return;

      for (const room of socket.rooms) {
        if (room.startsWith("dc:")) void socket.leave(room);
      }

      if (typeof warehouseId === "string" && warehouseId.length > 0) {
        void socket.leave(ALL_ROOM);
        void socket.join(dcRoom(warehouseId));
      } else {
        void socket.join(ALL_ROOM);
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
 * A network-wide client sits in `all`, a DC-confined one in its own room, and a
 * narrowed client in exactly one - so nobody receives a payload twice and nobody
 * receives one for a DC they cannot read.
 *
 * An unscoped payload reaches only `all`. That is correct for the counts broadcast,
 * which is a network total a DC-confined user should not be shown.
 */
export const emitAlert = (event: AlertEvent, payload: unknown, warehouseId?: string | null): void => {
  if (!io) return;

  const rooms = warehouseId ? [ALL_ROOM, dcRoom(warehouseId)] : [ALL_ROOM];
  io.to(rooms).emit(event, payload);
};
