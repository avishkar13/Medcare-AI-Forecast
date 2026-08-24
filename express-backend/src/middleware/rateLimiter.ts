import type { Request, RequestHandler } from "express";
import { ipKeyGenerator, rateLimit, type Store } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { RATE_LIMIT, SERVER } from "../config/constants.js";
import { redis } from "../config/redis.js";
import { redisKeys } from "../config/redis-keys.js";
import { TooManyRequestsError } from "../utils/errors.js";
import type { RateLimitRule, RateLimitStoreKind } from "../types.js";

const passthrough: RequestHandler = (_req, _res, next) => next();

const clientKey = (req: Request): string => {
  const identity = req.user?.id ?? req.get("x-api-key");
  if (identity) return `id:${identity}`;
  return `ip:${ipKeyGenerator(req.ip ?? "unknown", RATE_LIMIT.ipv6Subnet)}`;
};

const createStore = (name: string): Store | undefined => {
  const client = redis;
  if (!client) return undefined;
  return new RedisStore({
    prefix: redisKeys.rateLimit(name),
    sendCommand: (...args: string[]) => client.call(...(args as [string, ...string[]])) as Promise<never>,
  });
};

const retryAfterSeconds = (req: Request, windowMs: number): number => {
  const resetTime = req.rateLimit?.resetTime;
  const remainingMs = resetTime ? resetTime.getTime() - Date.now() : windowMs;
  return Math.max(1, Math.ceil(remainingMs / 1000));
};

export const createRateLimiter = (rule: RateLimitRule): RequestHandler => {
  if (!RATE_LIMIT.enabled) return passthrough;

  const store = createStore(rule.name);

  return rateLimit({
    windowMs: rule.windowMs,
    limit: rule.limit,
    skipSuccessfulRequests: rule.skipSuccessfulRequests ?? false,
    skipFailedRequests: rule.skipFailedRequests ?? false,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    identifier: rule.name,
    passOnStoreError: true,
    keyGenerator: clientKey,
    skip: (req) => RATE_LIMIT.allowlist.has(req.ip ?? "") || (rule.skip?.(req) ?? false),
    handler: (req, res, next) => {
      const retryAfter = retryAfterSeconds(req, rule.windowMs);
      res.setHeader("Retry-After", retryAfter);
      console.warn("rate limit exceeded", { tier: rule.name, key: clientKey(req), path: req.originalUrl });
      next(new TooManyRequestsError(retryAfter));
    },
    logger: {
      warn: (error, message) => console.warn(message ?? "rate limit store warning", error),
      error: (error, message) => console.error(message ?? "rate limit store error", error),
    },
    ...(store ? { store } : {}),
  });
};

const tier = (name: keyof typeof RATE_LIMIT.tiers, overrides?: Partial<RateLimitRule>) =>
  createRateLimiter({ name, ...RATE_LIMIT.tiers[name], ...overrides });

const healthPath = `${SERVER.apiPrefix}/health`;

export const rateLimiter = {
  global: tier("global", { skip: (req) => req.path.startsWith(healthPath) }),
  read: tier("read"),
  write: tier("write"),
  auth: tier("auth", { skipSuccessfulRequests: true }),
  expensive: tier("expensive"),
} as const;

export const rateLimitStoreKind = (): RateLimitStoreKind => {
  if (!RATE_LIMIT.enabled) return "disabled";
  return redis ? "redis" : "memory";
};
