import type { ApiErrorBody, RateLimitDetails, ValidationIssue } from "./types";

export const ApiErrorCode = {
  NotFound: "NOT_FOUND",
  ValidationFailed: "VALIDATION_FAILED",
  Conflict: "CONFLICT",
  ForeignKeyViolation: "FOREIGN_KEY_VIOLATION",
  MalformedJson: "MALFORMED_JSON",
  RateLimited: "RATE_LIMIT_EXCEEDED",
  DatabaseUnavailable: "DATABASE_UNAVAILABLE",
  ServiceUnavailable: "SERVICE_UNAVAILABLE",
  Internal: "INTERNAL_SERVER_ERROR",
  // not from the server: the request never got a reply
  NetworkError: "NETWORK_ERROR",
} as const;

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId: string | null;
  readonly details: unknown;

  constructor(args: {
    code: string;
    message: string;
    status: number;
    requestId?: string | null;
    details?: unknown;
  }) {
    super(args.message);
    this.name = "ApiError";
    this.code = args.code;
    this.status = args.status;
    this.requestId = args.requestId ?? null;
    this.details = args.details;
  }

  get isNotFound() {
    return this.code === ApiErrorCode.NotFound;
  }

  get isConflict() {
    return this.code === ApiErrorCode.Conflict;
  }

  get isValidation() {
    return this.code === ApiErrorCode.ValidationFailed;
  }

  // worth retrying on its own. a 4xx will fail the same way next time.
  get isRetryable() {
    return (
      this.code === ApiErrorCode.NetworkError ||
      this.code === ApiErrorCode.DatabaseUnavailable ||
      this.status >= 500
    );
  }

  get validationIssues(): ValidationIssue[] {
    return this.isValidation && Array.isArray(this.details)
      ? (this.details as ValidationIssue[])
      : [];
  }

  get retryAfterSeconds(): number | null {
    if (this.code !== ApiErrorCode.RateLimited) return null;
    const details = this.details as RateLimitDetails | undefined;
    return details?.retryAfterSeconds ?? null;
  }
}

export const isApiError = (error: unknown): error is ApiError =>
  error instanceof ApiError;

const looksLikeErrorBody = (body: unknown): body is ApiErrorBody =>
  typeof body === "object" &&
  body !== null &&
  "error" in body &&
  typeof (body as ApiErrorBody).error?.code === "string";

export const toApiError = (
  body: unknown,
  status: number,
  requestId: string | null,
): ApiError => {
  if (looksLikeErrorBody(body)) {
    const { error } = body;
    return new ApiError({
      code: error.code,
      message: error.message,
      status,
      requestId: error.requestId ?? requestId,
      details: error.details,
    });
  }

  // a proxy or a crash can answer with something that is not our envelope
  return new ApiError({
    code: ApiErrorCode.Internal,
    message: `request failed with status ${status}`,
    status,
    requestId,
  });
};
