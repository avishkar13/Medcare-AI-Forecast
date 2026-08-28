import { api } from "./client";
import type { QueryParams } from "./types";
import { planningParameterSchema, type PlanningParameter } from "@/schemas/parameters";

export type { PlanningParameter } from "@/schemas/parameters";

export interface ParameterListParams extends QueryParams {
  sku?: string;
  warehouse?: string;
  page?: number;
  pageSize?: number;
}

/**
 * PUT, not PATCH: the planning values are read as a set when safety stock is
 * computed, so they are written as a set. Upserts on the product/warehouse pair.
 *
 * `serviceLevel` is 0.5-0.999 and `maximumInventory` must be at or above
 * `minimumOrderQty` when both are set - the server rejects anything else with a 422.
 */
export interface UpsertParametersBody {
  sku: string;
  warehouse: string;
  leadTimeDays: number;
  leadTimeStdDev?: number;
  serviceLevel?: number;
  reviewPeriodDays?: number;
  minimumOrderQty?: number;
  maximumInventory?: number | null;
  holdingCostPerUnit: number;
  stockoutCostPerUnit: number;
  expiryCostPerUnit: number;
  /** Null clears the override and restores inheritance from the global setting. */
  alertStockoutProbability?: number | null;
  alertExpiryWindowDays?: number | null;
}

/**
 * A list is validated per row and bad rows are dropped rather than failing the page.
 */
const parseList = (rows: unknown): PlanningParameter[] => {
  if (!Array.isArray(rows)) return [];

  const parsed: PlanningParameter[] = [];
  for (const row of rows) {
    const result = planningParameterSchema.safeParse(row);
    if (result.success) parsed.push(result.data);
    else
      console.error(
        "dropped a planning parameter that did not match the contract",
        result.error.issues,
      );
  }
  return parsed;
};

export const listParameters = async (params?: ParameterListParams) => {
  const page = await api.getPage<unknown>("/planning/parameters", params);
  return { ...page, data: parseList(page.data) };
};

export const upsertParameters = async (body: UpsertParametersBody) =>
  planningParameterSchema.parse(await api.put<unknown>("/planning/parameters", body));
