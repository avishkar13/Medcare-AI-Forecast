"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/config/query-keys";
import { STALE_TIME } from "@/config/constants";
import { useUiStore } from "@/store/ui.store";
import {
  getDcExposure,
  getExpiryAssessment,
  getExpiryDemandCoverage,
  getExpiryExposure,
  getExpiryOverview,
  getExpiryTimeline,
  getWastePrevention,
  listExpiryBatches,
  type ExpiryParams,
} from "@/lib/api/expiry";

/**
 * Every expiry panel follows the DC selected in the top bar, and the DC is part of
 * every query key so two scopes are two caches.
 *
 * `/expiry/dc-exposure` is the deliberate exception: its whole job is the comparison
 * *between* DCs, and narrowing it to one would leave a single bar with nothing to
 * compare against.
 */
const useScopedParams = (params?: ExpiryParams): ExpiryParams => {
  const dc = useUiStore((state) => state.dc);
  // As with the DC: a link that names a SKU means it, and dropping it landed the
  // reader on every batch in the network instead of the one they asked about.
  const sku = useUiStore((state) => state.sku);
  return { ...params, ...(dc ? { warehouse: dc } : {}), ...(sku ? { sku } : {}) };
};

export function useExpiryBatches(pageSize = 200) {
  const scoped = useScopedParams({ pageSize });
  return useQuery({
    queryKey: queryKeys.expiry.batches(scoped),
    queryFn: () => listExpiryBatches(scoped),
    staleTime: STALE_TIME.list,
  });
}

export function useDcExposure() {
  return useQuery({
    queryKey: queryKeys.expiry.dcExposure(),
    queryFn: () => getDcExposure(),
    staleTime: STALE_TIME.dashboard,
  });
}

export function useWastePrevention() {
  const scoped = useScopedParams();
  return useQuery({
    queryKey: queryKeys.expiry.wastePrevention(scoped),
    queryFn: () => getWastePrevention(scoped),
    staleTime: STALE_TIME.reference,
  });
}

export function useExpiryOverview() {
  const scoped = useScopedParams();
  return useQuery({
    queryKey: queryKeys.expiry.overview(scoped),
    queryFn: () => getExpiryOverview(scoped),
    staleTime: STALE_TIME.dashboard,
  });
}

export function useExpiryTimeline() {
  const scoped = useScopedParams();
  return useQuery({
    queryKey: queryKeys.expiry.timeline(scoped),
    queryFn: () => getExpiryTimeline(scoped),
    staleTime: STALE_TIME.dashboard,
  });
}

export function useExpiryAssessment() {
  const scoped = useScopedParams();
  return useQuery({
    queryKey: queryKeys.expiry.assessment(scoped),
    queryFn: () => getExpiryAssessment(scoped),
    staleTime: STALE_TIME.dashboard,
  });
}


export function useExpiryExposure() {
  const scoped = useScopedParams();
  return useQuery({
    queryKey: queryKeys.expiry.exposure(scoped),
    queryFn: () => getExpiryExposure(scoped),
    staleTime: STALE_TIME.dashboard,
  });
}

export function useExpiryDemandCoverage() {
  const scoped = useScopedParams();
  return useQuery({
    queryKey: queryKeys.expiry.demandCoverage(scoped),
    queryFn: () => getExpiryDemandCoverage(scoped),
    staleTime: STALE_TIME.dashboard,
  });
}
