import { Redis } from "ioredis";
import { REDIS_URL } from "./constants.js";

export const redis = REDIS_URL
  ? new Redis(REDIS_URL, {
      enableOfflineQueue: true,
      maxRetriesPerRequest: 2,
      retryStrategy: (attempt: number) => Math.min(attempt * 200, 5_000),
    })
  : null;

redis?.on("error", (error: Error) => console.error("redis error", error));
redis?.on("ready", () => console.log("redis ready"));
redis?.on("end", () => console.warn("redis connection closed"));

export const isRedisHealthy = async (): Promise<boolean> => {
  if (!redis) return false;
  try {
    return (await redis.ping()) === "PONG";
  } catch {
    return false;
  }
};

export const disconnectRedis = async (): Promise<void> => {
  if (!redis) return;
  try {
    await redis.quit();
  } catch {
    redis.disconnect();
  }
};
