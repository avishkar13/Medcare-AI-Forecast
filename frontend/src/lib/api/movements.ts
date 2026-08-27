import { api } from "./client";
import type { QueryParams } from "./types";
import {
  dcSyncSchema,
  inventoryPlanSchema,
  recordMovementResultSchema,
  restockRequestSchema,
  stockMovementSchema,
  type RestockRequest,
  type StockMovement,
} from "@/schemas/movements";

export type {
  DcSync,
  InventoryPlan,
  InventoryPlanPoint,
  MovementType,
  RecordMovementResult,
  RestockRequest,
  RestockStatus,
  StockMovement,
} from "@/schemas/movements";
export { MOVEMENT_TYPES } from "@/schemas/movements";

export interface MovementListParams extends QueryParams {
  dc?: string;
  warehouse?: string;
  sku?: string;
  type?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Recording a movement.
 *
 * `quantity` is a positive magnitude for every type except `ADJUSTMENT`, which takes a
 * sign - the server rejects a signed directional quantity rather than guessing which
 * way it meant.
 */
export interface RecordMovementBody {
  sku: string;
  movementType: string;
  quantity: number;
  reference?: string;
  notes?: string;
  fromLocation?: string;
  toLocation?: string;
}

const parseList = (rows: unknown): StockMovement[] => {
  if (!Array.isArray(rows)) return [];

  const parsed: StockMovement[] = [];
  for (const row of rows) {
    const result = stockMovementSchema.safeParse(row);
    if (result.success) parsed.push(result.data);
    else console.error("dropped a movement that did not match the contract", result.error.issues);
  }
  return parsed;
};

export const listMovements = async (params?: MovementListParams) => {
  const page = await api.getPage<unknown>("/inventory/movements", params);
  return { ...page, data: parseList(page.data) };
};

/**
 * `idempotencyKey` is not optional in practice: a retried POST on a flaky connection
 * would otherwise apply the same sale twice and leave the position silently wrong.
 * Callers should mint one per user action, not per attempt.
 */
export const recordMovement = async (
  dc: string,
  body: RecordMovementBody,
  idempotencyKey?: string,
) =>
  recordMovementResultSchema.parse(
    await api.post<unknown>(
      `/dc/${encodeURIComponent(dc)}/movements`,
      body,
      idempotencyKey === undefined ? undefined : { "idempotency-key": idempotencyKey },
    ),
  );

export const getDcSync = async (dc: string) =>
  dcSyncSchema.parse(await api.get<unknown>(`/dc/${encodeURIComponent(dc)}/sync`));

export const getInventoryPlans = async (
  runId: string,
  params?: { sku?: string; warehouse?: string },
) =>
  inventoryPlanSchema.parse(
    await api.get<unknown>(`/planning/runs/${runId}/inventory-plans`, params),
  );

export interface RestockListParams extends QueryParams {
  warehouse?: string;
  sku?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

const parseRestock = (rows: unknown): RestockRequest[] => {
  if (!Array.isArray(rows)) return [];

  const parsed: RestockRequest[] = [];
  for (const row of rows) {
    const result = restockRequestSchema.safeParse(row);
    if (result.success) parsed.push(result.data);
    else
      console.error(
        "dropped a restock request that did not match the contract",
        result.error.issues,
      );
  }
  return parsed;
};

export const listRestockRequests = async (params?: RestockListParams) => {
  const page = await api.getPage<unknown>("/restock-requests", params);
  return { ...page, data: parseRestock(page.data) };
};

export const createRestockRequest = async (body: {
  sku: string;
  warehouse: string;
  quantity: number;
  reason?: string;
  notes?: string;
}) => restockRequestSchema.parse(await api.post<unknown>("/restock-requests", body));

export const approveRestockRequest = async (id: string) =>
  restockRequestSchema.parse(await api.patch<unknown>(`/restock-requests/${id}/approve`));

export const rejectRestockRequest = async (id: string) =>
  restockRequestSchema.parse(await api.patch<unknown>(`/restock-requests/${id}/reject`));
