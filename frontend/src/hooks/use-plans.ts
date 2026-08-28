"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/config/query-keys";
import { STALE_TIME } from "@/config/constants";
import { useUiStore } from "@/store/ui.store";
import {
  approveDrpPlan,
  approveSupplyPlan,
  listDrpPlans,
  listSupplyPlans,
  rejectDrpPlan,
  rejectSupplyPlan,
  type PlanListParams,
} from "@/lib/api/plans";

/**
 * Supply plans and DRP lanes for a run - by default the latest COMPLETED one.
 *
 * Both follow the DC in the top bar. On DRP the filter means "transfers this DC is
 * party to" at either end, which is the backend's own rule: filtering one side would
 * hide half of what a DC is being asked to do.
 */
const useScopedParams = (params?: PlanListParams): PlanListParams => {
  const dc = useUiStore((state) => state.dc);
  return { ...params, ...(dc ? { warehouse: dc } : {}) };
};

export function useSupplyPlans(params?: PlanListParams) {
  const scoped = useScopedParams(params);
  return useQuery({
    queryKey: queryKeys.plans.supply(scoped),
    queryFn: () => listSupplyPlans(scoped),
    staleTime: STALE_TIME.list,
  });
}

export function useDrpPlans(params?: PlanListParams) {
  const scoped = useScopedParams(params);
  return useQuery({
    queryKey: queryKeys.plans.drp(scoped),
    queryFn: () => listDrpPlans(scoped),
    staleTime: STALE_TIME.list,
  });
}

/**
 * Approve or reject a proposal. Both invalidate the whole group: a decision moves the
 * row out of the PROPOSED list that the supply page is usually filtered to.
 */
export function useSupplyPlanDecision() {
  const client = useQueryClient();
  const settle = () => client.invalidateQueries({ queryKey: queryKeys.plans.all });

  const approve = useMutation({ mutationFn: approveSupplyPlan, onSuccess: settle });
  const reject = useMutation({ mutationFn: rejectSupplyPlan, onSuccess: settle });

  return { approve, reject };
}

// a transfer is decided on the same terms, so it invalidates the same group
export function useDrpPlanDecision() {
  const client = useQueryClient();
  const settle = () => client.invalidateQueries({ queryKey: queryKeys.plans.all });

  const approve = useMutation({ mutationFn: approveDrpPlan, onSuccess: settle });
  const reject = useMutation({ mutationFn: rejectDrpPlan, onSuccess: settle });

  return { approve, reject };
}
