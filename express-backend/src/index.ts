import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { CORS, IS_PRODUCTION, SERVER } from "./config/constants.js";
import { disconnectPrisma } from "./config/prisma.js";
import { disconnectRedis } from "./config/redis.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import { rateLimiter, rateLimitStoreKind } from "./middleware/rateLimiter.js";
import { requestContext } from "./middleware/requestContext.js";
import { dashboardRouter } from "./routes/dashboard_route.js";
import { healthRouter } from "./routes/health_route.js";
import { masterDataRouter } from "./routes/masterdata_route.js";

const app = express();

app.use(requestContext);
app.use(helmet({ contentSecurityPolicy: IS_PRODUCTION, crossOriginResourcePolicy: { policy: "same-site" } }));
app.use(
  cors({
    origin: CORS.origins,
    credentials: CORS.credentials,
    exposedHeaders: [...CORS.exposedHeaders],
    maxAge: CORS.maxAgeSeconds,
  }),
);
app.use(rateLimiter.global);
app.use(compression());
app.use(express.json({ limit: SERVER.bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: SERVER.bodyLimit }));

app.use(`${SERVER.apiPrefix}/health`, healthRouter);
app.use(SERVER.apiPrefix, masterDataRouter);
app.use(`${SERVER.apiPrefix}/dashboard`, dashboardRouter);

app.use(notFound);
app.use(errorHandler);

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
