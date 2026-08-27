import { api } from "./client";
import type { QueryParams } from "./types";
import {
  dashboardSummarySchema,
  expiryRiskSchema,
  networkCenterSchema,
  priorityActionsSchema,
  type DashboardSummary,
  type ExpiryRisk,
  type NetworkCenter,
  type PriorityActions,
} from "@/schemas/dashboard";
import { z } from "zod";

export type {
  DashboardKPIs,
  DashboardSummary,
  ExpiryRisk,
  ExpiryRiskItem,
  NetworkCenter,
  NetworkHealth,
  PriorityAction,
  PriorityActions,
} from "@/schemas/dashboard";

/**
 * `warehouseId` narrows the hub to one DC. It is optional everywhere: a caller
 * already confined to a DC is narrowed by the server whether or not it is sent.
 */
export interface DashboardScope extends QueryParams {
  warehouseId?: string;
}

export const getSummary = async (scope?: DashboardScope): Promise<DashboardSummary> =>
  dashboardSummarySchema.parse(await api.get<unknown>("/dashboard/summary", scope));

export const getNetwork = async (scope?: DashboardScope): Promise<NetworkCenter[]> =>
  z.array(networkCenterSchema).parse(await api.get<unknown>("/dashboard/network", scope));

export const getPriorityActions = async (scope?: DashboardScope): Promise<PriorityActions> =>
  priorityActionsSchema.parse(await api.get<unknown>("/dashboard/priority-actions", scope));

export const getExpiryRisk = async (scope?: DashboardScope): Promise<ExpiryRisk> =>
  expiryRiskSchema.parse(await api.get<unknown>("/dashboard/expiry-risk", scope));
