import { ZodError } from "zod";
import type { ErrorDetails } from "../types.js";

export const isValidationError = (error: unknown): error is ZodError => error instanceof ZodError;

export const toErrorDetails = (error: ZodError): ErrorDetails =>
  error.issues.map(({ path, code, message }) => ({ path: path.join("."), code, message }));

export const toReadableLines = (error: ZodError): string =>
  error.issues.map(({ path, message }) => `  ${path.join(".") || "(root)"}: ${message}`).join("\n");
