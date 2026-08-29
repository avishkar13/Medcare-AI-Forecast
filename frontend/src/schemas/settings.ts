import { z } from "zod";

/**
 * The settings boundary. Follows `schemas/alerts.ts`.
 *
 * Settings is the one surface where a silently dropped field is invisible: a toggle
 * that parses as `undefined` renders as off, and the user is looking at a control
 * that claims a state the server does not hold. Every field is therefore required
 * here - `settings.service.ts` reads four tables that all have defaults, so nothing
 * on this response is optional.
 */

export const generalSettingsSchema = z.object({
  workspaceName: z.string(),
  organization: z.string(),
  region: z.string(),
  timezone: z.string(),
  dateFormat: z.string(),
  currency: z.string(),
  language: z.string(),
  theme: z.enum(["light", "dark", "system"]),
  density: z.enum(["comfortable", "compact"]),
  defaultLandingPage: z.string(),
});

export const alertSettingsSchema = z.object({
  realTimeMonitoring: z.boolean(),
  types: z.object({
    stockoutRisk: z.boolean(),
    demandSpike: z.boolean(),
    expiryRisk: z.boolean(),
    supplierDelay: z.boolean(),
    capacityBreach: z.boolean(),
    overstock: z.boolean(),
  }),
  thresholds: z.object({
    stockoutProbability: z.number(),
    demandDeviation: z.number(),
    expiryWindow: z.number(),
    capacityUtilization: z.number(),
    supplierDelay: z.number(),
  }),
  escalation: z.object({
    critical: z.string(),
    high: z.string(),
    medium: z.string(),
    low: z.string(),
  }),
});

export const notificationRuleSchema = z.object({
  event: z.string(),
  inApp: z.boolean(),
  email: z.boolean(),
  sms: z.boolean(),
});

export const notificationSettingsSchema = z.object({
  channels: z.object({
    inApp: z.boolean(),
    email: z.boolean(),
    sms: z.boolean(),
    teams: z.boolean(),
  }),
  rules: z.array(notificationRuleSchema),
  dailyDigest: z.object({ enabled: z.boolean(), deliveryTime: z.string() }),
});

export const aiSettingsSchema = z.object({
  primaryModel: z.string(),
  modelConfidence: z.number(),
  recommendationConfidence: z.number(),
  features: z.object({
    recommendations: z.boolean(),
    explainability: z.boolean(),
    autoRiskDetection: z.boolean(),
  }),
  decisionFactors: z.object({
    demandForecast: z.number(),
    inventoryPosition: z.number(),
    leadTime: z.number(),
    expiryRisk: z.number(),
    networkCapacity: z.number(),
  }),
});

export const appSettingsSchema = z.object({
  general: generalSettingsSchema,
  alerts: alertSettingsSchema,
  notifications: notificationSettingsSchema,
  ai: aiSettingsSchema,
});

export type AppSettings = z.infer<typeof appSettingsSchema>;
export type NotificationRule = z.infer<typeof notificationRuleSchema>;
