import { api } from "./client";
import type { SystemAlert } from "@/types/alert";

export interface AlertOverview {
  totalCount: number;
  criticalCount: number;
  highCount: number;
  unresolvedCount: number;
  resolvedCount: number;
  resolvedPercentage: number | null;
  todayCount: number;
  todayDelta: number;
}

export const listAlerts = (params?: { pageSize?: number; status?: string }) =>
  api.getPage<SystemAlert[]>("/alerts", params);

export const getOverview = () => api.get<AlertOverview>("/alerts/overview");

export const acknowledgeAlert = (id: string) =>
  api.patch<SystemAlert>(`/alerts/${id}/acknowledge`);

export const resolveAlert = (id: string) => api.patch<SystemAlert>(`/alerts/${id}/resolve`);

export const markAllRead = () =>
  api.post<{ updatedCount: number }>("/alerts/mark-all-read");

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
