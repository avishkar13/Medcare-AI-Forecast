"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/config/query-keys";
import { STALE_TIME } from "@/config/constants";
import {
  getInventoryDetail,
  getInventoryHealth,
  listInventory,
  type InventoryListParams,
} from "@/lib/api/inventory";

/**
 * Filters go to the server.
 *
 * This used to fetch a fixed 200 rows and let the page narrow them in the browser,
 * which capped the network at whatever came back first and made paging decorative.
 * The params are part of the query key, so two filter states are two caches.
 */
export function useInventory(params: InventoryListParams = {}) {
  return useQuery({
    queryKey: queryKeys.inventory.list(params),
    queryFn: () => listInventory(params),
    staleTime: STALE_TIME.list,
  });
}

export function useInventoryHealth(warehouseId?: string) {
  return useQuery({
    queryKey: queryKeys.dashboard.inventoryHealth(warehouseId),
    queryFn: () => getInventoryHealth(warehouseId ? { warehouseId } : undefined),
    staleTime: STALE_TIME.dashboard,
  });
}

export function useInventoryDetail(sku: string | null) {
  return useQuery({
    queryKey: queryKeys.inventory.one(sku ?? "none"),
    queryFn: () => getInventoryDetail(sku!),
    enabled: Boolean(sku),
    staleTime: STALE_TIME.list,
  });
}
