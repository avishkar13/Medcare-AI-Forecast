"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/config/query-keys";
import { STALE_TIME } from "@/config/constants";
import {
  getInventoryDetail,
  getInventoryHealth,
  listInventory,
} from "@/lib/api/inventory";

// the network is 160 positions, so one page covers it and the existing client-side
// filtering keeps working. push filters server-side when it outgrows that.
export function useInventory(pageSize = 200) {
  return useQuery({
    queryKey: queryKeys.inventory.list({ pageSize }),
    queryFn: () => listInventory({ pageSize }),
    staleTime: STALE_TIME.list,
  });
}

export function useInventoryHealth() {
  return useQuery({
    queryKey: queryKeys.dashboard.inventoryHealth(),
    queryFn: getInventoryHealth,
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
