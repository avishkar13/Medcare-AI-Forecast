import type { ErrorRequestHandler } from "express";
import { IS_PRODUCTION } from "../config/constants.js";
import { Prisma } from "../generated/prisma/client.js";
import { AppError } from "../utils/errors.js";
import { isValidationError, toErrorDetails } from "../zod/errors.js";
import type { NormalizedError } from "../types.js";

const PRISMA_ERRORS: Record<string, NormalizedError> = {
  P2000: { statusCode: 400, code: "VALUE_TOO_LONG", message: "A provided value exceeds the allowed length" },
  P2002: { statusCode: 409, code: "CONFLICT", message: "A record with these values already exists" },
  P2003: { statusCode: 409, code: "FOREIGN_KEY_VIOLATION", message: "A related record is missing or still referenced" },
  P2025: { statusCode: 404, code: "NOT_FOUND", message: "Record not found" },
};

const normalize = (error: unknown): NormalizedError => {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
    };
  }

  if (isValidationError(error)) {
    return {
      statusCode: 422,
      code: "VALIDATION_FAILED",
      message: "Request validation failed",
      details: toErrorDetails(error),
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return PRISMA_ERRORS[error.code] ?? { statusCode: 400, code: `PRISMA_${error.code}`, message: "Database request rejected" };
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return { statusCode: 400, code: "DATABASE_VALIDATION_FAILED", message: "Malformed database query" };
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return { statusCode: 503, code: "DATABASE_UNAVAILABLE", message: "Database is unavailable" };
  }

  if (error instanceof SyntaxError && "body" in error) {
    return { statusCode: 400, code: "MALFORMED_JSON", message: "Request body is not valid JSON" };
  }

  return { statusCode: 500, code: "INTERNAL_SERVER_ERROR", message: "Something went wrong" };
};

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const { statusCode, code, message, details } = normalize(error);

  if (statusCode >= 500) console.error(message, { requestId: req.id, code, error });
  else console.warn(message, { requestId: req.id, code });

  res.status(statusCode).json({
    error: {
      code,
      message: statusCode >= 500 && IS_PRODUCTION ? "Something went wrong" : message,
      ...(details === undefined ? {} : { details }),
      requestId: req.id,
    },
  });
};
