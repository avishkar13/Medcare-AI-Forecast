"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/config/query-keys";
import { STALE_TIME } from "@/config/constants";
import { listDistributors, listProducts, listWarehouses } from "@/lib/api/masterdata";

export function useProducts(pageSize = 200) {
  return useQuery({
    queryKey: queryKeys.masterdata.products({ pageSize }),
    queryFn: async () => (await listProducts({ pageSize })).data,
    staleTime: STALE_TIME.reference,
  });
}

export function useWarehouses() {
  return useQuery({
    queryKey: queryKeys.masterdata.warehouses(),
    queryFn: listWarehouses,
    staleTime: STALE_TIME.reference,
  });
}

export function useDistributors() {
  return useQuery({
    queryKey: queryKeys.masterdata.distributors(),
    queryFn: listDistributors,
    staleTime: STALE_TIME.reference,
  });
}
