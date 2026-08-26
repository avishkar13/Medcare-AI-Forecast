import { FORECAST } from "../config/constants.js";
import {
  forecastResponseSchema,
  forecastViolations,
  type ForecastRequest,
  type ForecastResponse,
} from "../zod/forecast.schemas.js";

export class ForecastServiceError extends Error {
  readonly attempts: number;
  readonly retryable: boolean;

  constructor(
    message: string,
    options: { attempts?: number; retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "ForecastServiceError";
    this.attempts = options.attempts ?? 1;
    this.retryable = options.retryable ?? false;
  }
}

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const BACKOFF_MS = [500, 1500];

const nextDay = (isoDay: string): string => {
  const date = new Date(`${isoDay}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const parse = (payload: unknown, request: ForecastRequest): ForecastResponse => {
  const parsed = forecastResponseSchema.safeParse(payload);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new ForecastServiceError(`forecast response is malformed (${detail})`);
  }

  const violations = forecastViolations(parsed.data, request, nextDay(request.asOf));
  if (violations.length > 0) {
    throw new ForecastServiceError(
      `forecast response failed validation: ${violations.slice(0, 3).join("; ")}`,
    );
  }

  return parsed.data;
};

const attempt = async (url: string, request: ForecastRequest): Promise<ForecastResponse> => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(FORECAST.timeoutMs),
  });

  if (!response.ok) {
    throw new ForecastServiceError(`forecast service answered ${response.status}`, {
      retryable: RETRYABLE_STATUSES.has(response.status),
    });
  }

  return parse(await response.json(), request);
};

/**
 * One forecast call, retried on network errors, 5xx and 429 only. A 4xx will fail
 * identically on retry, and a malformed body is not a transport problem, so neither
 * is retried.
 */
export const requestForecast = async (request: ForecastRequest): Promise<ForecastResponse> => {
  const url = FORECAST.serviceUrl;
  if (!url) throw new ForecastServiceError("no forecast service is configured", { attempts: 0 });

  const total = FORECAST.retries + 1;
  let last: unknown;

  for (let tries = 1; tries <= total; tries += 1) {
    const startedAt = Date.now();

    try {
      const response = await attempt(`${url.replace(/\/$/, "")}/forecast`, request);
      console.log("forecast served", {
        pairs: request.pairs.length,
        horizonDays: request.horizonDays,
        attempt: tries,
        ms: Date.now() - startedAt,
      });
      return response;
    } catch (error) {
      last = error;
      // A network error or an aborted timeout is worth another attempt; a rejected
      // response is only retried when the service said it was transient.
      const retryable = error instanceof ForecastServiceError ? error.retryable : true;

      console.warn("forecast attempt failed", {
        pairs: request.pairs.length,
        horizonDays: request.horizonDays,
        attempt: tries,
        ms: Date.now() - startedAt,
        reason: error instanceof Error ? error.message : String(error),
      });

      if (!retryable) break;
      if (tries < total) await delay(BACKOFF_MS[tries - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1]!);
    }
  }

  const reason = last instanceof Error ? last.message : String(last);
  throw new ForecastServiceError(reason, { attempts: total, cause: last });
};

export const isForecastServiceHealthy = async (): Promise<boolean> => {
  const url = FORECAST.serviceUrl;
  if (!url) return false;

  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/health`, {
      signal: AbortSignal.timeout(Math.min(FORECAST.timeoutMs, 5_000)),
    });
    return response.ok;
  } catch {
    return false;
  }
};

export interface TrainingOutcome {
  modelVersion: string;
  trainingRecords: number;
  testRecords: number;
  calibrationOk: boolean | null;
  metrics: { mae: number | null; rmse: number | null; wape: number | null };
  bias: number | null;
  coverage: number | null;
  ms: number;
}

/**
 * Asks the engine to refit.
 *
 * **Not retried.** Every other engine call is idempotent and cheap; a fit costs
 * minutes of CPU and rewrites the model artefact, so a retry could stack two
 * trainings over the same files. A caller that wants another attempt asks again.
 *
 * The engine pulls `GET /api/training-data` itself, exactly as inference does, so
 * one data path serves fit and predict.
 */
export const requestTraining = async (modelVersion?: string): Promise<TrainingOutcome> => {
  const url = FORECAST.serviceUrl;
  if (!url) throw new ForecastServiceError("no forecast service is configured", { attempts: 0 });

  const startedAt = Date.now();
  let response: Response;

  try {
    response = await fetch(`${url.replace(/\/$/, "")}/train`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(modelVersion === undefined ? {} : { modelVersion }),
      signal: AbortSignal.timeout(FORECAST.trainTimeoutMs),
    });
  } catch (error) {
    throw new ForecastServiceError(
      `training request failed: ${error instanceof Error ? error.message : String(error)}`,
      { retryable: false, cause: error },
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | {
        modelVersion?: string;
        trainingRecords?: number;
        testRecords?: number;
        calibrationOk?: boolean | null;
        summary?: Record<string, number | null>;
        error?: { code?: string; message?: string };
      }
    | null;

  if (!response.ok) {
    // The engine's own error envelope carries why. Surfacing it beats "502".
    const detail = payload?.error?.message ?? `training service answered ${response.status}`;
    throw new ForecastServiceError(detail, { retryable: false });
  }

  const summary = payload?.summary ?? {};
  return {
    modelVersion: payload?.modelVersion ?? "unknown",
    trainingRecords: payload?.trainingRecords ?? 0,
    testRecords: payload?.testRecords ?? 0,
    calibrationOk: payload?.calibrationOk ?? null,
    metrics: {
      mae: summary.mae ?? null,
      rmse: summary.rmse ?? null,
      wape: summary.wape ?? null,
    },
    bias: summary.bias ?? null,
    coverage: summary.coverage ?? null,
    ms: Date.now() - startedAt,
  };
};

/** The last fit's full report, straight from the engine. */
export const fetchModelMetrics = async (): Promise<unknown> => {
  const url = FORECAST.serviceUrl;
  if (!url) throw new ForecastServiceError("no forecast service is configured", { attempts: 0 });

  const response = await fetch(`${url.replace(/\/$/, "")}/model/metrics`, {
    signal: AbortSignal.timeout(Math.min(FORECAST.timeoutMs, 15_000)),
  });

  if (!response.ok) {
    throw new ForecastServiceError(`model metrics unavailable (${response.status})`, {
      retryable: false,
    });
  }
  return response.json();
};
