import { env } from "./env.js";

const list = (value: string) =>
  value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const corsOrigins = list(env.CORS_ORIGINS);

export const IS_PRODUCTION = env.NODE_ENV === "production";
export const IS_TEST = env.NODE_ENV === "test";
export const REQUEST_ID_HEADER = "x-request-id";
export const TRAINING_ROWS_HEADER = "x-training-rows";

export const SERVER = {
  host: env.HOST,
  port: env.PORT,
  apiPrefix: env.API_PREFIX,
  bodyLimit: env.BODY_LIMIT,
  shutdownTimeoutMs: env.SHUTDOWN_TIMEOUT_MS,
  keepAliveTimeoutMs: 65_000,
  headersTimeoutMs: 66_000,
  requestTimeoutMs: 30_000,
} as const;

export const CORS = {
  origins: corsOrigins.includes("*") ? "*" : corsOrigins,
  credentials: corsOrigins.includes("*") ? false : env.CORS_CREDENTIALS,
  exposedHeaders: [REQUEST_ID_HEADER, TRAINING_ROWS_HEADER, "RateLimit", "RateLimit-Policy", "Retry-After"],
  maxAgeSeconds: 86_400,
} as const;

export const RATE_LIMIT = {
  enabled: env.RATE_LIMIT_ENABLED,
  ipv6Subnet: env.RATE_LIMIT_IPV6_SUBNET,
  allowlist: new Set(list(env.RATE_LIMIT_ALLOWLIST)),
  tiers: {
    global: { windowMs: env.RATE_LIMIT_GLOBAL_WINDOW_MS, limit: env.RATE_LIMIT_GLOBAL_MAX },
    read: { windowMs: env.RATE_LIMIT_READ_WINDOW_MS, limit: env.RATE_LIMIT_READ_MAX },
    write: { windowMs: env.RATE_LIMIT_WRITE_WINDOW_MS, limit: env.RATE_LIMIT_WRITE_MAX },
    auth: { windowMs: env.RATE_LIMIT_AUTH_WINDOW_MS, limit: env.RATE_LIMIT_AUTH_MAX },
    expensive: { windowMs: env.RATE_LIMIT_EXPENSIVE_WINDOW_MS, limit: env.RATE_LIMIT_EXPENSIVE_MAX },
  },
} as const;

export const PLANNING = {
  runTimeoutMs: env.PLANNING_RUN_TIMEOUT_MS,
  idempotencyTtlMs: env.PLANNING_IDEMPOTENCY_TTL_MS,
  lockTtlMs: 10_000,
  systemUserEmail: "system@medcare.local",
  activeStatuses: ["PENDING", "RUNNING"],
} as const;

export const DATABASE_URL = env.DATABASE_URL;
export const REDIS_URL = env.REDIS_URL;
export const NODE_ENV = env.NODE_ENV;
