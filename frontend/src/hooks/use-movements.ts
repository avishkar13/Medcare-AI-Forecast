"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/config/query-keys";
import { STALE_TIME } from "@/config/constants";
import { useUiStore } from "@/store/ui.store";
import {
  approveRestockRequest,
  createRestockRequest,
  getDcSync,
  getInventoryPlans,
  listMovements,
  listRestockRequests,
  recordMovement,
  rejectRestockRequest,
  type MovementListParams,
  type RecordMovementBody,
  type RestockListParams,
} from "@/lib/api/movements";

/** The ledger, following the DC in the top bar like every other scoped list. */
export function useMovements(params?: MovementListParams) {
  const dc = useUiStore((state) => state.dc);
  const scoped: MovementListParams = { ...params, ...(dc ? { warehouse: dc } : {}) };

  return useQuery({
    queryKey: queryKeys.movements.list(scoped),
    queryFn: () => listMovements(scoped),
    staleTime: STALE_TIME.list,
    // The socket carries alert events, not movement events, so a movement that raises
    // nothing does not push. A slow poll is what makes the feed honest for viewers
    // who did not record it themselves; see `live-activity.tsx`.
    refetchInterval: 30_000,
  });
}

export function useDcSync(dc?: string) {
  return useQuery({
    queryKey: queryKeys.movements.sync(dc ?? "none"),
    queryFn: () => getDcSync(dc!),
    enabled: Boolean(dc),
    staleTime: STALE_TIME.dashboard,
  });
}

/**
 * Recording a movement invalidates far more than the ledger.
 *
 * A movement changes the position, the position changes the dashboard, and detection
 * runs on the way out - so alerts move too. Invalidating narrowly here is how a page
 * ends up showing the stock level from before the sale it just recorded.
 */
export function useRecordMovement() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({
      dc,
      body,
      idempotencyKey,
    }: {
      dc: string;
      body: RecordMovementBody;
      idempotencyKey?: string;
    }) => recordMovement(dc, body, idempotencyKey),
    onSuccess: () => {
      for (const key of [
        queryKeys.movements.all,
        queryKeys.inventory.all,
        queryKeys.dashboard.all,
        queryKeys.alerts.all,
        queryKeys.expiry.all,
      ]) {
        void client.invalidateQueries({ queryKey: key });
      }
    },
  });
}

export function useInventoryPlans(
  runId: string | null,
  params?: { sku?: string; warehouse?: string },
) {
  const dc = useUiStore((state) => state.dc);
  const scoped = { ...params, ...(dc ? { warehouse: dc } : {}) };

  return useQuery({
    queryKey: queryKeys.planning.inventoryPlans(runId ?? "none", scoped),
    queryFn: () => getInventoryPlans(runId!, scoped),
    enabled: Boolean(runId),
    staleTime: STALE_TIME.dashboard,
  });
}

export function useRestockRequests(params?: RestockListParams) {
  const dc = useUiStore((state) => state.dc);
  const scoped: RestockListParams = { ...params, ...(dc ? { warehouse: dc } : {}) };

  return useQuery({
    queryKey: queryKeys.restock.list(scoped),
    queryFn: () => listRestockRequests(scoped),
    staleTime: STALE_TIME.list,
  });
}

export function useRestockActions() {
  const client = useQueryClient();
  const settle = () => client.invalidateQueries({ queryKey: queryKeys.restock.all });

  const create = useMutation({ mutationFn: createRestockRequest, onSuccess: settle });
  const approve = useMutation({ mutationFn: approveRestockRequest, onSuccess: settle });
  const reject = useMutation({ mutationFn: rejectRestockRequest, onSuccess: settle });

  return { create, approve, reject };
}
