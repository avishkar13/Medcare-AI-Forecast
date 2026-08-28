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
  warehouseId: text.optional(),
  productId: text.optional(),
  status: text.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const deliveryQuerySchema = z.object({
  alertId: text.optional(),
  channel: text.optional(),
  status: text.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const alertTrendQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  warehouseId: text.optional(),
});

/**
 * The scope-only query the summary reads accept.
 *
 * `/overview`, `/trends` and `/distribution` took no query at all, so they answered
 * network-wide while `/alerts` honoured `?warehouseId=` - the KPI strip on a DC-scoped
 * page reported 9 critical and 38 unresolved over a list showing 8 alerts, 5 critical.
 */
export const alertScopeQuerySchema = z.object({
  warehouseId: text.optional(),
});

export const alertParamsSchema = z.object({ id: text });

export type AlertQuery = z.infer<typeof alertQuerySchema>;
export type DeliveryQuery = z.infer<typeof deliveryQuerySchema>;
export type AlertTrendQuery = z.infer<typeof alertTrendQuerySchema>;
export type AlertParams = z.infer<typeof alertParamsSchema>;
