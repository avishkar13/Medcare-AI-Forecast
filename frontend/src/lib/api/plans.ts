import { api } from "./client";
import type { QueryParams } from "./types";
import {
  drpPlanListSchema,
  drpPlanSchema,
  supplyPlanListSchema,
  supplyPlanSchema,
} from "@/schemas/plans";

export type {
  DrpPlan,
  DrpPlanList,
  PlanStatus,
  SupplyPlan,
  SupplyPlanList,
} from "@/schemas/plans";

/**
 * `runId` defaults to the latest COMPLETED run. `warehouse` accepts an id, a code or
 * a name, and on DRP it means "transfers this DC is party to" at either end.
 */
export interface PlanListParams extends QueryParams {
  runId?: string;
  sku?: string;
  warehouse?: string;
  status?: string;
  source?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Both routes paginate, so `total` and `planningRunId` come off `meta` rather than
 * out of the body - `planningRunId` is which run these plans belong to, and a page
 * that loses it can show one run's orders under another run's heading.
 */
export const listSupplyPlans = async (params?: PlanListParams) => {
  const page = await api.getPage<unknown>("/supply-plans", params);
  return { ...page, data: supplyPlanListSchema.parse(page.data) };
};

export const listDrpPlans = async (params?: PlanListParams) => {
  const page = await api.getPage<unknown>("/drp-plans", params);
  return { ...page, data: drpPlanListSchema.parse(page.data) };
};

/**
 * A decision on a proposal. It records intent - nothing here moves stock.
 * `PROPOSED` is the only actionable state; a decided plan answers 409.
 */
export const approveSupplyPlan = async (id: string) =>
  supplyPlanSchema.parse(await api.patch<unknown>(`/supply-plans/${id}/approve`));

export const rejectSupplyPlan = async (id: string) =>
  supplyPlanSchema.parse(await api.patch<unknown>(`/supply-plans/${id}/reject`));

export const approveDrpPlan = async (id: string) =>
  drpPlanSchema.parse(await api.patch<unknown>(`/drp-plans/${id}/approve`));

export const rejectDrpPlan = async (id: string) =>
  drpPlanSchema.parse(await api.patch<unknown>(`/drp-plans/${id}/reject`));
