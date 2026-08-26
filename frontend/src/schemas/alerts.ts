import { z } from "zod";

/**
 * The alert boundary.
 *
 * Every other `schemas/*` file is still a stub, so the API layer casts responses into
 * hand-written interfaces with nothing checking the cast: a renamed backend field
 * ships silently and surfaces as `undefined` inside a chart. This is the first one
 * parsed for real, and the shape the rest follow.
 *
 * Deliberately permissive where the backend is: `severity`, `type` and `status` are
 * plain strings there rather than enums, so a new detector must not make an existing
 * client reject the whole page.
 *
 * The backend returns null where a figure cannot be derived, so these are nullable
 * rather than optional.
 */

export const alertMetricSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
});

export const alertTimelineEventSchema = z.object({
  id: z.string(),
  time: z.string(),
  description: z.string(),
});

export const alertSchema = z.object({
  id: z.string(),
  severity: z.string(),
  type: z.string(),
  title: z.string(),
  sku: z.string().nullable(),
  product: z.string().nullable(),
  location: z.string(),
  productId: z.string().nullable(),
  warehouseId: z.string().nullable(),
  status: z.string(),
  businessImpact: z.string(),
  recommendedAction: z.string(),
  explanation: z.string(),
  detectedAt: z.string(),
  updatedAt: z.string(),
  ageDays: z.number(),
  metrics: z.array(alertMetricSchema),
  timeline: z.array(alertTimelineEventSchema),
});

export const alertOverviewSchema = z.object({
  totalCount: z.number(),
  criticalCount: z.number(),
  highCount: z.number(),
  unresolvedCount: z.number(),
  resolvedCount: z.number(),
  resolvedPercentage: z.number().nullable(),
  todayCount: z.number(),
  todayDelta: z.number(),
});

export const detectionOutcomeSchema = z.object({
  detected: z.number(),
  created: z.number(),
  retained: z.number(),
  resolved: z.number(),
  notified: z.number(),
  skipped: z.boolean(),
});

export const notificationDeliverySchema = z.object({
  id: z.string(),
  alertId: z.string(),
  channel: z.string(),
  status: z.string(),
  recipient: z.string().nullable(),
  error: z.string().nullable(),
  attempts: z.number(),
  createdAt: z.string(),
  alertTitle: z.string(),
  alertSeverity: z.string(),
  alertType: z.string(),
});

export const testNotificationSchema = z.object({
  results: z.array(
    z.object({
      channel: z.string(),
      status: z.string(),
      recipient: z.string().nullable(),
      error: z.string().nullable(),
    }),
  ),
});

// Schemas own the boundary shapes; `types/` owns what is internal to the app.
export type Alert = z.infer<typeof alertSchema>;
export type AlertOverview = z.infer<typeof alertOverviewSchema>;
export type DetectionOutcome = z.infer<typeof detectionOutcomeSchema>;
export type NotificationDelivery = z.infer<typeof notificationDeliverySchema>;
export type TestNotificationResult = z.infer<typeof testNotificationSchema>;
