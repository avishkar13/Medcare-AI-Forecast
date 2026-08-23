import { env } from "./env.js";

const root = env.RATE_LIMIT_PREFIX;

export const redisKeys = {
  rateLimit: (tier: string) => `${root}:rl:${tier}:`,
  cache: (domain: string, id: string) => `${root}:cache:${domain}:${id}`,
  lock: (name: string) => `${root}:lock:${name}`,
  idempotency: (key: string) => `${root}:idem:${key}`,
} as const;
