"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/config/query-keys";
import { STALE_TIME } from "@/config/constants";
import {
  getDcExposure,
  getExpiryAssessment,
  getExpiryDemandCoverage,
  getExpiryExposure,
  getExpiryOverview,
  getExpiryTimeline,
  getWastePrevention,
  listAllExpiryBatches,
  listExpiryBatches,
} from "@/lib/api/expiry";

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

export function useExpiryOverview() {
  return useQuery({
    queryKey: queryKeys.expiry.overview(),
    queryFn: getExpiryOverview,
    staleTime: STALE_TIME.dashboard,
  });
}

export function useExpiryTimeline() {
  return useQuery({
    queryKey: queryKeys.expiry.timeline(),
    queryFn: getExpiryTimeline,
    staleTime: STALE_TIME.dashboard,
  });
}

export function useExpiryAssessment() {
  return useQuery({
    queryKey: queryKeys.expiry.assessment(),
    queryFn: getExpiryAssessment,
    staleTime: STALE_TIME.dashboard,
  });
}

export function useAllExpiryBatches() {
  return useQuery({
    queryKey: queryKeys.expiry.batches({ all: true }),
    queryFn: listAllExpiryBatches,
    staleTime: STALE_TIME.list,
  });
}

export function useExpiryExposure() {
  return useQuery({
    queryKey: queryKeys.expiry.exposure(),
    queryFn: getExpiryExposure,
    staleTime: STALE_TIME.dashboard,
  });
}

export function useExpiryDemandCoverage() {
  return useQuery({
    queryKey: queryKeys.expiry.demandCoverage(),
    queryFn: getExpiryDemandCoverage,
    staleTime: STALE_TIME.dashboard,
  });
}
