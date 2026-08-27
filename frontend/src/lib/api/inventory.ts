import { api } from "./client";
import type { QueryParams } from "./types";
import {
  inventoryDetailSchema,
  inventoryHealthSchema,
  inventoryListSchema,
  type InventoryDetail,
  type InventoryHealth,
  type InventoryList,
} from "@/schemas/inventory";

export type {
  InventoryBatch,
  InventoryDetail,
  InventoryHealth,
  InventoryList,
  InventoryPosition,
  InventoryTotals,
} from "@/schemas/inventory";

/**
 * Every filter is applied by the server.
 *
 * The page used to ask for 200 rows and narrow them in the browser, which made the
 * page control decorative and quietly capped the network at whatever came back first.
 * `warehouse` accepts an id, a code or a display name (`inventory.service.ts`
 * matches on all three), so the DC selector and the location filter share one field.
 */
export interface InventoryListParams extends QueryParams {
  search?: string;
  category?: string;
  warehouse?: string;
  criticality?: string;
  status?: string;
  risk?: string;
  sort?: "sku" | "risk" | "daysOfSupply" | "inventoryValue";
  page?: number;
  pageSize?: number;
}

export const listInventory = async (params?: InventoryListParams): Promise<InventoryList> =>
  inventoryListSchema.parse(await api.get<unknown>("/inventory", params));

export const getInventoryHealth = async (params?: {
  warehouseId?: string;
}): Promise<InventoryHealth> =>
  inventoryHealthSchema.parse(await api.get<unknown>("/dashboard/inventory-health", params));

export const getInventoryDetail = async (sku: string): Promise<InventoryDetail> =>
  inventoryDetailSchema.parse(
    await api.get<unknown>(`/inventory/${encodeURIComponent(sku)}`),
  );
