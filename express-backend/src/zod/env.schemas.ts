import { z } from "zod";

const port = z.coerce.number().int().min(1).max(65535);
const durationMs = z.coerce.number().int().positive();
const count = z.coerce.number().int().positive();
const stringbool = z.enum(["true", "false", "1", "0"]).transform((v) => v === "true" || v === "1");
const optionalUrl = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === undefined || value === "" ? undefined : value));
// An empty string in a .env file means "unset", not "set to nothing".
const optionalText = optionalUrl;

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

    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters in production"),
    JWT_EXPIRES_IN: z.string().default("1d"),

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
    PLANNING_EXECUTOR: z.enum(["inline", "disabled"]).default("inline"),
    PLANNING_SIMULATION_ITERATIONS: count.default(500),
    // 0 disables pruning entirely.
    PLANNING_RETENTION_RUNS: z.coerce.number().int().min(0).max(1000).default(20),

    FORECAST_SERVICE_URL: optionalUrl,
    FORECAST_TIMEOUT_MS: durationMs.default(60_000),
    FORECAST_RETRIES: z.coerce.number().int().min(0).max(10).default(2),
    FORECAST_FALLBACK: stringbool.default(true),
    // Fitting reads the whole export and trains several models; it is minutes, not seconds.
    FORECAST_TRAIN_TIMEOUT_MS: durationMs.default(600_000),

    // Detection cadence. 0 disables the scheduler; the manual route still works.
    ALERT_DETECTION_INTERVAL_MS: z.coerce.number().int().min(0).default(300_000),
    // Every provider credential is optional. An unconfigured channel records SKIPPED
    // rather than failing the run, so a deploy with no mail account still detects.
    RESEND_API_KEY: optionalText,
    EMAIL_FROM: optionalText,
    ALERT_EMAIL_RECIPIENTS: z.string().default(""),
    AWS_REGION: optionalText,
    AWS_ACCESS_KEY_ID: optionalText,
    AWS_SECRET_ACCESS_KEY: optionalText,
    // Set a topic and SNS fans out to its subscribers; otherwise each number is
    // published to individually. One or the other, topic wins.
    AWS_SNS_TOPIC_ARN: optionalText,
    AWS_SNS_SENDER_ID: optionalText,
    TEAMS_WEBHOOK_URL: optionalUrl,
    ALERT_SMS_RECIPIENTS: z.string().default(""),
    // Which severities are worth interrupting someone for. In-app always gets all.
    NOTIFY_MIN_SEVERITY: z.enum(["critical", "high", "medium", "low"]).default("high"),
    NOTIFY_TIMEOUT_MS: durationMs.default(10_000),
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
