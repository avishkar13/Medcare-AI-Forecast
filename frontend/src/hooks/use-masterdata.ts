"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/config/query-keys";
import { STALE_TIME } from "@/config/constants";
import {
  listDistributors,
  listProducts,
  listPromotions,
  listWarehouses,
} from "@/lib/api/masterdata";

export function useProducts(pageSize = 200) {
  return useQuery({
    queryKey: queryKeys.masterdata.products({ pageSize }),
    queryFn: async () => (await listProducts({ pageSize })).data,
    staleTime: STALE_TIME.reference,
  });
}

/**
 * The DC list, which the scope selector and every location filter read.
 *
 * Deliberately unscoped: the backend already narrows it to the caller's own DC when
 * they are confined, and narrowing it again here would leave the selector with
 * nothing to select.
 */
export function useWarehouses() {
  return useQuery({
    queryKey: queryKeys.masterdata.warehouses(),
    queryFn: () => listWarehouses(),
    staleTime: STALE_TIME.reference,
  });
}

export function useDistributors() {
  return useQuery({
    queryKey: queryKeys.masterdata.distributors(),
    queryFn: () => listDistributors(),
    staleTime: STALE_TIME.reference,
  });
}

export function usePromotions(pageSize = 200) {
  return useQuery({
    queryKey: queryKeys.masterdata.promotions({ pageSize }),
    queryFn: async () => (await listPromotions({ pageSize })).data,
    staleTime: STALE_TIME.reference,
  });
}
