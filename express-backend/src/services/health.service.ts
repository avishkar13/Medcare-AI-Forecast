import { isDatabaseHealthy } from "../config/prisma.js";
import { isRedisHealthy } from "../config/redis.js";
import { FORECAST, REDIS_URL } from "../config/constants.js";
import { isForecastServiceHealthy } from "../lib/forecast-client.js";
import type { ReadinessReport } from "../types.js";

export const checkReadiness = async (): Promise<ReadinessReport> => {
  const [database, cache, engine] = await Promise.all([
    isDatabaseHealthy(),
    REDIS_URL ? isRedisHealthy() : Promise.resolve(null),
    FORECAST.serviceUrl ? isForecastServiceHealthy() : Promise.resolve(null),
  ]);

  const dependencies = {
    database: database ? ("up" as const) : ("down" as const),
    redis: cache === null ? ("not_configured" as const) : cache ? ("up" as const) : ("down" as const),
    forecast:
      engine === null ? ("not_configured" as const) : engine ? ("up" as const) : ("down" as const),
  };

  // A dead engine only blocks readiness when nothing can cover for it. With the
  // fallback enabled the instance still answers every route and still produces
  // plans, so it stays in rotation - degrading here would have the Docker
  // HEALTHCHECK restart a container that is working.
  const blocking = [
    dependencies.database,
    dependencies.redis,
    ...(FORECAST.fallbackEnabled ? [] : [dependencies.forecast]),
  ];

  return {
    status: blocking.includes("down") ? "degraded" : "ok",
    uptimeSeconds: Math.round(process.uptime()),
    dependencies,
  };
};
