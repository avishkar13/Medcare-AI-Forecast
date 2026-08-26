import { api } from "./client";
import type { QueryParams } from "./types";
import {
  alertOverviewSchema,
  alertSchema,
  detectionOutcomeSchema,
  notificationDeliverySchema,
  testNotificationSchema,
  type AlertOverview,
  type DetectionOutcome,
  type NotificationDelivery,
  type TestNotificationResult,
} from "@/schemas/alerts";
import type { SystemAlert } from "@/types/alert";
import { z } from "zod";

/**
 * Every filter here is applied by the server.
 *
 * The alerts page used to request `pageSize: 200` and filter the result in the
 * browser, which meant paging was decorative and the severity/type/location filters
 * only ever narrowed whatever the first 200 rows happened to be.
 */
export type AlertListParams = QueryParams & {
  severity?: string;
  type?: string;
  status?: string;
  location?: string;
  warehouseId?: string;
  productId?: string;
  page?: number;
  pageSize?: number;
};

/**
 * Responses are parsed, not cast.
 *
 * A list is validated per row and bad rows are dropped rather than failing the page:
 * one malformed alert should not blank the whole review surface, and the console line
 * is what makes the drift visible.
 */
const parseList = (rows: unknown): SystemAlert[] => {
  if (!Array.isArray(rows)) return [];

  const parsed: SystemAlert[] = [];
  for (const row of rows) {
    const result = alertSchema.safeParse(row);
    if (result.success) parsed.push(result.data as unknown as SystemAlert);
    else console.error("dropped an alert that did not match the contract", result.error.issues);
  }
  return parsed;
};

export const listAlerts = async (params?: AlertListParams) => {
  const page = await api.getPage<unknown>("/alerts", params);
  return { ...page, data: parseList(page.data) };
};

export const getOverview = async (): Promise<AlertOverview> =>
  alertOverviewSchema.parse(await api.get<unknown>("/alerts/overview"));

export const acknowledgeAlert = (id: string) =>
  api.patch<SystemAlert>(`/alerts/${id}/acknowledge`);

export const resolveAlert = (id: string) => api.patch<SystemAlert>(`/alerts/${id}/resolve`);

export const markAllRead = () =>
  api.post<{ updatedCount: number }>("/alerts/mark-all-read");

/** Runs a detection cycle now. Answers synchronously with what it reconciled. */
export const refreshAlerts = async (): Promise<DetectionOutcome> =>
  detectionOutcomeSchema.parse(await api.post<unknown>("/alerts/refresh"));

export const listDeliveries = async (params?: {
  alertId?: string;
  channel?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) => {
  const page = await api.getPage<unknown>("/alerts/notifications", params);
  const rows = z.array(notificationDeliverySchema).safeParse(page.data);
  return { ...page, data: rows.success ? (rows.data as NotificationDelivery[]) : [] };
};

export const sendTestNotification = async (): Promise<TestNotificationResult> =>
  testNotificationSchema.parse(await api.post<unknown>("/alerts/test-notification"));

export interface AlertDistribution {
  totalAlerts: number;
  byLocation: { location: string; count: number; sharePercent: number }[];
  byType: { type: string; count: number; sharePercent: number }[];
  bySeverity: { severity: string; count: number; sharePercent: number }[];
}

export interface AlertTrendPoint {
  date: string;
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface AlertHealth {
  alertsTracked: number;
  openAlerts: number;
  lastDetectedAt: string | null;
  oldestOpenAlertId: string | null;
  oldestOpenAgeDays: number | null;
}

export const getDistribution = () => api.get<AlertDistribution>("/alerts/distribution");

export interface AlertTrends {
  points: AlertTrendPoint[];
  comparison: {
    halfWindowDays: number;
    currentCritical: number;
    previousCritical: number;
    criticalChangePercent: number | null;
  };
}

export const getTrends = (days = 14) => api.get<AlertTrends>("/alerts/trends", { days });
export const getHealth = () => api.get<AlertHealth>("/alerts/health");

export type { AlertOverview };
