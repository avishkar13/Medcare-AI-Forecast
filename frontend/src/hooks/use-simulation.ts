"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { queryKeys } from "@/config/query-keys";
import { PLANNING_POLL_MS, STALE_TIME } from "@/config/constants";
import {
  deleteScenario,
  listHistory,
  listSaved,
  runWhatIf,
  saveScenario,
  type WhatIfRequestParams,
} from "@/lib/api/simulation";
import {
  compareRuns,
  getRun,
  getRunOptimization,
  getRunSimulation,
  listRuns,
} from "@/lib/api/planning";

export function useSimulationHistory(limit = 20) {
  return useQuery({
    queryKey: queryKeys.simulation.history({ limit }),
    queryFn: () => listHistory(limit),
    staleTime: STALE_TIME.list,
  });
}

export function useSavedScenarios(limit = 20) {
  return useQuery({
    queryKey: queryKeys.simulation.saved({ limit }),
    queryFn: () => listSaved(limit),
    staleTime: STALE_TIME.list,
  });
}

export function useScenarioMutations() {
  const client = useQueryClient();
  const settle = () => client.invalidateQueries({ queryKey: queryKeys.simulation.all });

  return {
    save: useMutation({ mutationFn: saveScenario, onSuccess: settle }),
    remove: useMutation({ mutationFn: deleteScenario, onSuccess: settle }),
  };
}

/**
 * a what-if is a real planning run, so it is start-then-poll rather than
 * request-response. the run id is held here and the poll stops once it settles.
 */
export function useWhatIf() {
  const client = useQueryClient();
  const [runId, setRunId] = useState<string | null>(null);

  const start = useMutation({
    mutationFn: (body: { name: string; horizonDays?: number; params: WhatIfRequestParams }) =>
      runWhatIf(body),
    onSuccess: (accepted) => {
      setRunId(accepted.run.id);
      void client.invalidateQueries({ queryKey: queryKeys.simulation.all });
    },
  });

  const run = useQuery({
    queryKey: queryKeys.planning.run(runId ?? "none"),
    queryFn: () => getRun(runId!),
    enabled: Boolean(runId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "COMPLETED" || status === "FAILED" ? false : PLANNING_POLL_MS;
    },
  });

  const settled = run.data?.status === "COMPLETED";

  const simulation = useQuery({
    queryKey: queryKeys.planning.simulation(runId ?? "none"),
    queryFn: () => getRunSimulation(runId!),
    enabled: Boolean(runId) && settled,
  });

  const optimization = useQuery({
    queryKey: queryKeys.planning.optimization(runId ?? "none"),
    queryFn: () => getRunOptimization(runId!),
    enabled: Boolean(runId) && settled,
  });

  // the metrics are current-vs-simulated, which needs a baseline. the most recent
  // completed run that is not this one is the honest choice.
  const candidates = useQuery({
    queryKey: queryKeys.planning.runs({ status: "COMPLETED", pageSize: 5 }),
    queryFn: () => listRuns({ status: "COMPLETED", pageSize: 5 }),
    enabled: Boolean(runId) && settled,
  });

  const baselineId =
    candidates.data?.data.find((candidate) => candidate.id !== runId)?.id ?? null;

  const comparison = useQuery({
    queryKey: queryKeys.planning.compare(runId ?? "none", baselineId ?? "none"),
    queryFn: () => compareRuns(runId!, baselineId!),
    enabled: Boolean(runId && baselineId && settled),
  });

  return {
    start,
    runId,
    comparison: comparison.data ?? null,
    run: run.data ?? null,
    simulation: simulation.data ?? null,
    optimization: optimization.data ?? null,
    // running covers the whole cycle: accepted, executing, and reading the results
    isRunning:
      start.isPending ||
      (Boolean(runId) && !settled && run.data?.status !== "FAILED") ||
      (settled && (simulation.isPending || optimization.isPending)),
    failed: run.data?.status === "FAILED",
    failureReason: run.data?.failureReason ?? null,
  };
}
