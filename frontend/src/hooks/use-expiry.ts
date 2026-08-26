"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/config/query-keys";
import { STALE_TIME } from "@/config/constants";
import { getDcExposure, getWastePrevention, listExpiryBatches } from "@/lib/api/expiry";

export function useExpiryBatches(pageSize = 200) {
  return useQuery({
    queryKey: queryKeys.expiry.batches({ pageSize }),
    queryFn: () => listExpiryBatches({ pageSize }),
    staleTime: STALE_TIME.list,
  });
}

export function useDcExposure() {
  return useQuery({
    queryKey: queryKeys.expiry.dcExposure(),
    queryFn: getDcExposure,
    staleTime: STALE_TIME.dashboard,
  });
}

export function useWastePrevention() {
  return useQuery({
    queryKey: queryKeys.expiry.wastePrevention(),
    queryFn: getWastePrevention,
    staleTime: STALE_TIME.reference,
  });
}
