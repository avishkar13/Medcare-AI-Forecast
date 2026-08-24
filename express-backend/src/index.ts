import "dotenv/config";
import { app } from "./app.js";
import { SERVER } from "./config/constants.js";
import { disconnectPrisma } from "./config/prisma.js";
import { disconnectRedis } from "./config/redis.js";
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

  server.closeIdleConnections();
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });

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
