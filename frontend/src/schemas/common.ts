import { z } from "zod";

/**
 * Shapes shared across boundaries.
 *
 * The response envelope is asserted by the backend's own test suite and every doc
 * file: `{ data, meta }` on success, `{ error }` on failure, with `meta.generatedAt`
 * always present and `page`/`pageSize`/`total` added by paginated routes.
 *
 * `lib/api/client.ts` unwraps the envelope before any per-route schema sees the
 * payload, so these are here for the places that need to reason about the wrapper
 * itself rather than for routine parsing.
 */

export const responseMetaSchema = z.object({
  generatedAt: z.string(),
  page: z.number().optional(),
  pageSize: z.number().optional(),
  total: z.number().optional(),
  /** Present only on routes scoped to a single planning run. */
  planningRunId: z.string().nullable().optional(),
});

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  // An array of field issues for VALIDATION_FAILED, an object for RATE_LIMIT_EXCEEDED.
  details: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).optional(),
  requestId: z.string(),
});

export const envelope = <T extends z.ZodTypeAny>(data: T) =>
  z.object({ data, meta: responseMetaSchema });

/** ISO-8601 instant. The API returns dates as strings, never as Date objects. */
export const isoDateTime = z.string();

/** `YYYY-MM-DD`. Used where the API deliberately drops the time component. */
export const isoDate = z.string();

export type ResponseMeta = z.infer<typeof responseMetaSchema>;
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
