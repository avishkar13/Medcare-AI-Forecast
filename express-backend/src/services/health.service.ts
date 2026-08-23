import { isDatabaseHealthy } from "../config/prisma.js";
import { isRedisHealthy } from "../config/redis.js";
import { REDIS_URL } from "../config/constants.js";
import type { ReadinessReport } from "../types.js";

export const checkReadiness = async (): Promise<ReadinessReport> => {
  const [database, cache] = await Promise.all([
    isDatabaseHealthy(),
    REDIS_URL ? isRedisHealthy() : Promise.resolve(null),
  ]);

  const dependencies = {
    database: database ? ("up" as const) : ("down" as const),
    redis: cache === null ? ("not_configured" as const) : cache ? ("up" as const) : ("down" as const),
  };

  return {
    status: Object.values(dependencies).includes("down") ? "degraded" : "ok",
    uptimeSeconds: Math.round(process.uptime()),
    dependencies,
  };
};
