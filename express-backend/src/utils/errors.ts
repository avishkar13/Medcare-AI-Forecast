import type { AppErrorOptions, ErrorDetails } from "../types.js";

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: ErrorDetails | undefined;
  readonly expose: boolean;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    options: AppErrorOptions = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = options.details;
    this.expose = statusCode < 500;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", details?: ErrorDetails) {
    super(400, "BAD_REQUEST", message, details === undefined ? {} : { details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(401, "UNAUTHORIZED", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Insufficient permissions") {
    super(403, "FORBIDDEN", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(404, "NOT_FOUND", message);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource already exists", details?: ErrorDetails) {
    super(409, "CONFLICT", message, details === undefined ? {} : { details });
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message = "Validation failed", details?: ErrorDetails) {
    super(422, "VALIDATION_FAILED", message, details === undefined ? {} : { details });
  }
}

export class TooManyRequestsError extends AppError {
  constructor(retryAfterSeconds: number) {
    super(429, "RATE_LIMIT_EXCEEDED", "Too many requests, please retry later", {
      details: { retryAfterSeconds },
    });
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = "Service temporarily unavailable", details?: ErrorDetails) {
    super(503, "SERVICE_UNAVAILABLE", message, details === undefined ? {} : { details });
  }
}
