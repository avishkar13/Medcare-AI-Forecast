import type { Server as HttpServer } from "node:http";
import jwt from "jsonwebtoken";
import type { Redis } from "ioredis";
import { createAdapter } from "@socket.io/redis-adapter";
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
/** The adapter's own Redis connections, so shutdown can close what it opened. */
let adapterClients: Redis[] | null = null;

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

export const attachRealtime = async (server: HttpServer): Promise<Server> => {
  io = new Server(server, {
    path: "/socket.io",
    cors: { origin: CORS.origins, credentials: CORS.credentials },
    // Behind a proxy that cannot upgrade, long-polling still delivers. Listing both
    // lets the client negotiate down instead of failing closed.
    transports: ["websocket", "polling"],
    serveClient: false,
  });

  /**
   * Fan emits out across instances when Redis is available.
   *
   * The default adapter keeps rooms in this process's memory, so with two replicas a
   * detection cycle on instance A reaches only the clients connected to A - and does
   * so silently, which is the worst kind of scaling bug. The adapter publishes each
   * emit on a Redis channel instead, so every instance delivers to its own clients.
   *
   * Optional on purpose: `REDIS_URL` is unset in plenty of local setups, and one
   * process needs no fan-out. `duplicate()` because the adapter needs connections in
   * subscriber mode, which cannot also serve the rate limiter's commands.
   *
   * Imported here rather than at the top of the file. `config/redis.js` opens its
   * connection at module scope, and this module is reachable from the detector - so a
   * static import made `prisma/seed.ts` and every one-off script hold an open socket
   * and never exit, long after their work was done.
   */
  const { redis } = await import("../config/redis.js");

  if (redis) {
    // Held so shutdown can close them; `io.close()` does not own connections it was
    // handed, and leaving two subscribers open keeps the process alive.
    adapterClients = [redis.duplicate(), redis.duplicate()];
    io.adapter(createAdapter(adapterClients[0]!, adapterClients[1]!));
  } else {
    console.warn("REDIS_URL is not set: realtime events stay within this process");
  }

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

  const clients = adapterClients;
  adapterClients = null;
  if (clients) {
    // Settled, not awaited individually: a subscriber that is already gone must not
    // hold up a shutdown that is on a timer.
    await Promise.allSettled(clients.map((client) => client.quit()));
  }
};

export const realtimeConnections = (): number => io?.engine.clientsCount ?? 0;

/**
 * Emitted to the network room and, when the payload is scoped, to that DC's room.
 *
 * A network-wide client sits in `all`, a DC-confined one in its own room, and a
 * narrowed client in exactly one - so nobody receives a payload twice and nobody
 * receives one for a DC they cannot read.
 *
 * An unscoped payload reaches only `all`. Counts use `emitAlertToDc` below to give
 * each DC room its own subtotal rather than the network figure.
 */
export const emitAlert = (event: AlertEvent, payload: unknown, warehouseId?: string | null): void => {
  if (!io) return;

  const rooms = warehouseId ? [ALL_ROOM, dcRoom(warehouseId)] : [ALL_ROOM];
  io.to(rooms).emit(event, payload);
};

/**
 * One DC's room and nothing else.
 *
 * Separate from `emitAlert` because the payload differs per room rather than being
 * the same thing fanned out: counts are per-DC totals, and a network-wide client must
 * not receive another DC's subtotal as if it were the network's.
 */
export const emitAlertToDc = (
  event: AlertEvent,
  payload: unknown,
  warehouseId: string,
): void => {
  io?.to(dcRoom(warehouseId)).emit(event, payload);
};
