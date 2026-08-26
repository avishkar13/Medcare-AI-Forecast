import "dotenv/config";
import { app } from "./app.js";
import { SERVER } from "./config/constants.js";
import { disconnectPrisma } from "./config/prisma.js";
import { disconnectRedis } from "./config/redis.js";
import { drainPlanning } from "./lib/planning-runner.js";
import { startAlertScheduler, stopAlertScheduler } from "./lib/alert-scheduler.js";
import { attachRealtime, closeRealtime } from "./lib/realtime.js";
import { failAbandonedRuns } from "./services/planning.service.js";
import { rateLimitStoreKind } from "./middleware/rateLimiter.js";

const storeKind = rateLimitStoreKind();
if (storeKind === "memory") {
  console.warn("REDIS_URL is not set: rate limits are per-process and will not hold across instances");
}

const server = app.listen(SERVER.port, SERVER.host, () => {
  console.log("server listening", {
    url: `http://${SERVER.host}:${SERVER.port}${SERVER.apiPrefix}`,
    rateLimitStore: storeKind,
  });
});

attachRealtime(server);
startAlertScheduler();

// A crash or a kill leaves runs stuck at PENDING/RUNNING. Sweep them at boot rather
// than waiting for the next POST to notice.
void failAbandonedRuns()
  .then(({ count }) => {
    if (count > 0) console.warn("failed abandoned planning runs at boot", { count });
  })
  .catch((error) => console.error("could not sweep abandoned planning runs", error));

server.keepAliveTimeout = SERVER.keepAliveTimeoutMs;
server.headersTimeout = SERVER.headersTimeoutMs;
server.requestTimeout = SERVER.requestTimeoutMs;

let shuttingDown = false;

const shutdown = async (reason: string, exitCode: number) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("shutting down", { reason });

  const forceExit = setTimeout(() => {
    console.error("shutdown timed out, forcing exit", { reason });
    process.exit(1);
  }, SERVER.shutdownTimeoutMs).unref();

  // Sockets are long-lived by design, so `server.close` would wait on every open one.
  // Closing them first is what lets the http server actually finish closing.
  await closeRealtime();

  server.closeIdleConnections();
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });

  // Between closing the socket and dropping the connections: both a run and a
  // detection cycle still need Prisma.
  await Promise.all([
    drainPlanning(SERVER.planningDrainTimeoutMs),
    stopAlertScheduler(SERVER.planningDrainTimeoutMs),
  ]);

  for (const result of await Promise.allSettled([disconnectPrisma(), disconnectRedis()])) {
    if (result.status === "rejected") console.error("teardown failed", result.reason);
  }

  clearTimeout(forceExit);
  console.log("shutdown complete");
  process.exit(exitCode);
};

process.once("SIGINT", () => void shutdown("SIGINT", 0));
process.once("SIGTERM", () => void shutdown("SIGTERM", 0));
process.on("unhandledRejection", (reason) => {
  console.error("unhandled rejection", reason);
  void shutdown("unhandledRejection", 1);
});
process.on("uncaughtException", (error) => {
  console.error("uncaught exception", error);
  void shutdown("uncaughtException", 1);
});
