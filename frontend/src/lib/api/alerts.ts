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
