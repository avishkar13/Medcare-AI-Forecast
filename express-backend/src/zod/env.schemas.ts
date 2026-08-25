import { z } from "zod";

const port = z.coerce.number().int().min(1).max(65535);
const durationMs = z.coerce.number().int().positive();
const count = z.coerce.number().int().positive();
const stringbool = z.enum(["true", "false", "1", "0"]).transform((v) => v === "true" || v === "1");

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: port.default(4000),
    HOST: z.string().min(1).default("0.0.0.0"),
    API_PREFIX: z.string().regex(/^\/[a-z0-9/-]*$/, "must start with /").default("/api"),
    SHUTDOWN_TIMEOUT_MS: durationMs.default(10_000),
    BODY_LIMIT: z.string().min(1).default("1mb"),

    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1).optional(),

    CORS_ORIGINS: z.string().default("http://localhost:3000"),
    CORS_CREDENTIALS: stringbool.default(true),

    RATE_LIMIT_ENABLED: stringbool.default(true),
    RATE_LIMIT_PREFIX: z.string().min(1).default("rl"),
    RATE_LIMIT_IPV6_SUBNET: z.coerce.number().int().min(32).max(128).default(56),
    RATE_LIMIT_ALLOWLIST: z.string().default(""),
    RATE_LIMIT_GLOBAL_WINDOW_MS: durationMs.default(60_000),
    RATE_LIMIT_GLOBAL_MAX: count.default(300),
    RATE_LIMIT_READ_WINDOW_MS: durationMs.default(60_000),
    RATE_LIMIT_READ_MAX: count.default(120),
    RATE_LIMIT_WRITE_WINDOW_MS: durationMs.default(60_000),
    RATE_LIMIT_WRITE_MAX: count.default(30),
    RATE_LIMIT_AUTH_WINDOW_MS: durationMs.default(900_000),
    RATE_LIMIT_AUTH_MAX: count.default(5),
    RATE_LIMIT_EXPENSIVE_WINDOW_MS: durationMs.default(3_600_000),
    RATE_LIMIT_EXPENSIVE_MAX: count.default(10),

    PLANNING_RUN_TIMEOUT_MS: durationMs.default(900_000),
    PLANNING_IDEMPOTENCY_TTL_MS: durationMs.default(86_400_000),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === "production" && !value.REDIS_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["REDIS_URL"],
        message: "required in production so rate limits are shared across instances",
      });
    }
  });
