import { api } from "./client";
import type { QueryParams, ResponseMeta } from "./types";
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

/**
 * `totals` covers the whole filtered set; `items` is one page of it.
 *
 * `meta` carries the server's row count, which is the only honest source for "showing
 * 1-10 of N" - counting `items` reports the page size back to the reader as if it
 * were the network.
 */
export interface InventoryListPage extends InventoryList {
  meta: ResponseMeta;
}

export const listInventory = async (
  params?: InventoryListParams,
): Promise<InventoryListPage> => {
  const page = await api.getPage<unknown>("/inventory", params);
  return { ...inventoryListSchema.parse(page.data), meta: page.meta };
};

export const getInventoryHealth = async (params?: {
  warehouseId?: string;
}): Promise<InventoryHealth> =>
  inventoryHealthSchema.parse(await api.get<unknown>("/dashboard/inventory-health", params));

export const getInventoryDetail = async (sku: string): Promise<InventoryDetail> =>
  inventoryDetailSchema.parse(
    await api.get<unknown>(`/inventory/${encodeURIComponent(sku)}`),
  );
