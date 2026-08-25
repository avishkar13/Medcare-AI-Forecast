import { z } from "zod";

const text = z.string().trim().min(1);

/**
 * `severity`, `type` and `status` are plain strings in the schema, so these are
 * open filters rather than enums - a new severity added by a producer must not make
 * the read route reject it. `status=open` is the one alias, covering every
 * not-yet-resolved state.
 */
export const alertQuerySchema = z.object({
  severity: text.optional(),
  type: text.optional(),
  location: text.optional(),
  status: text.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const alertTrendQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export const alertParamsSchema = z.object({ id: text });

export type AlertQuery = z.infer<typeof alertQuerySchema>;
export type AlertTrendQuery = z.infer<typeof alertTrendQuerySchema>;
export type AlertParams = z.infer<typeof alertParamsSchema>;
