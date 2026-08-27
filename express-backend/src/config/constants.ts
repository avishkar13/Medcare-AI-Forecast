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
  // Draining planning runs gets most of the shutdown budget; the rest is left for
  // marking whatever did not finish FAILED and disconnecting cleanly.
  planningDrainTimeoutMs: Math.max(1_000, Math.round(env.SHUTDOWN_TIMEOUT_MS * 0.8)),
  keepAliveTimeoutMs: 65_000,
  headersTimeoutMs: 66_000,
  requestTimeoutMs: 30_000,
} as const;

export const CORS = {
  origins: corsOrigins.includes("*") ? "*" : corsOrigins,
  credentials: corsOrigins.includes("*") ? false : env.CORS_CREDENTIALS,
  exposedHeaders: [REQUEST_ID_HEADER, TRAINING_ROWS_HEADER, "x-future-promotions", "x-future-signals", "RateLimit", "RateLimit-Policy", "Retry-After"],
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
  executor: env.PLANNING_EXECUTOR,
  simulationIterations: env.PLANNING_SIMULATION_ITERATIONS,
  // How many COMPLETED runs keep their plan artefacts. 0 disables pruning.
  retentionRuns: env.PLANNING_RETENTION_RUNS,
  // Fixed, so two runs over the same inputs produce the same numbers. A run that
  // cannot be reproduced cannot be compared against another one.
  simulationSeed: 0x5eed_1a4b,
  // No lane or distance model exists, so one flat rate per unit moved. A TransferLane
  // model is the honest fix if per-lane costs ever matter.
  transferCostPerUnit: 0.05,
  // The review list stays usable; anything past this is noise a planner never reaches.
  maxRecommendations: 200,
} as const;

export const FORECAST = {
  serviceUrl: env.FORECAST_SERVICE_URL,
  timeoutMs: env.FORECAST_TIMEOUT_MS,
  retries: env.FORECAST_RETRIES,
  fallbackEnabled: env.FORECAST_FALLBACK,
  trainTimeoutMs: env.FORECAST_TRAIN_TIMEOUT_MS,
  fallbackModelVersion: "naive-seasonal-fallback",
} as const;

export const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 } as const;

export const NOTIFY = {
  detectionIntervalMs: env.ALERT_DETECTION_INTERVAL_MS,
  timeoutMs: env.NOTIFY_TIMEOUT_MS,
  minSeverity: env.NOTIFY_MIN_SEVERITY,
  email: {
    apiKey: env.RESEND_API_KEY,
    from: env.EMAIL_FROM,
    recipients: list(env.ALERT_EMAIL_RECIPIENTS),
  },
  teams: {
    webhookUrl: env.TEAMS_WEBHOOK_URL,
  },
  sms: {
    region: env.AWS_REGION,
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    topicArn: env.AWS_SNS_TOPIC_ARN,
    senderId: env.AWS_SNS_SENDER_ID,
    recipients: list(env.ALERT_SMS_RECIPIENTS),
  },
} as const;

export const DATABASE_URL = env.DATABASE_URL;
export const REDIS_URL = env.REDIS_URL;
export const NODE_ENV = env.NODE_ENV;
