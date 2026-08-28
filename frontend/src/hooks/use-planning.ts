"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/config/query-keys";
import { PLANNING_POLL_MS, STALE_TIME } from "@/config/constants";
import {
  compareRuns,
  createRun,
  getRun,
  getRunOptimization,
  getRunSimulation,
  listRuns,
} from "@/lib/api/planning";

/**
 * The stages the executor walks, in order, with the progress each reports.
 *
 * Named here rather than derived from the run so the ladder can be drawn before the
 * first poll returns - a caller needs to show the whole path, not just the step it
 * happens to be on.
 */
export const PLANNING_STAGES = [
  { key: "inputs", label: "Loading inputs" },
  { key: "forecast", label: "Forecasting demand" },
  { key: "projection", label: "Projecting inventory" },
  { key: "supply", label: "Planning supply" },
  { key: "drp", label: "Allocating transfers" },
  { key: "optimization", label: "Optimising cost" },
  { key: "simulation", label: "Simulating outcomes" },
  { key: "recommendations", label: "Writing recommendations" },
] as const;

/**
 * Runs the planner and waits for it.
 *
 * This is what turns the engine on. `POST /planning/runs` and every read route it
 * feeds have existed and been tested since Phase C, but nothing in the product ever
 * called this one - so `Forecast`, `SupplyPlan`, `DRPPlan`, `Recommendation`,
 * `OptimizationResult` and `SimulationRun` were all empty, and the forecast, supply
 * and recommendation surfaces rendered nulls over a fully working engine.
 *
 * The route answers 202 with a run to poll rather than blocking for the ~30s the
 * executor takes, so the polling below is the contract, not a workaround.
 */
export function useRunPlanning() {
  const client = useQueryClient();
  const [runId, setRunId] = useState<string | null>(null);

  const start = useMutation({
    mutationFn: (body?: { horizonDays?: number; scenarioId?: string }) => createRun(body),
    onSuccess: (run) => setRunId(run.id),
    onError: () => toast.error("Could not start the planning run"),
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

  const status = run.data?.status;
  const isRunning = start.isPending || status === "PENDING" || status === "RUNNING";

  /**
   * A completed run rewrites most of the read model at once, so the invalidation is
   * broad on purpose: forecasts, plans, recommendations and the dashboard all read
   * rows this run just replaced. Alerts too - detection runs at the tail of the
   * executor.
   */
  const [settledId, setSettledId] = useState<string | null>(null);
  if (runId && runId !== settledId && (status === "COMPLETED" || status === "FAILED")) {
    setSettledId(runId);

    if (status === "COMPLETED") {
      for (const key of [
        queryKeys.planning.all,
        queryKeys.forecast.all,
        queryKeys.recommendations.all,
        queryKeys.plans.all,
        queryKeys.dashboard.all,
        queryKeys.alerts.all,
        queryKeys.inventory.all,
      ]) {
        void client.invalidateQueries({ queryKey: key });
      }
      toast.success("Planning run complete", {
        description: "Forecasts, supply plans, transfers and recommendations have been rebuilt.",
      });
    } else {
      toast.error("Planning run failed", {
        description: run.data?.failureReason ?? "The run stopped before finishing.",
      });
    }
  }

  return {
    startRun: start.mutate,
    isRunning,
    run: run.data ?? null,
    stage: run.data?.currentStage ?? null,
    progress: run.data?.progress ?? null,
  };
}

export function useCompletedRuns(pageSize = 10) {
  return useQuery({
    queryKey: queryKeys.planning.runs({ status: "COMPLETED", pageSize }),
    queryFn: () => listRuns({ status: "COMPLETED", pageSize }),
    staleTime: STALE_TIME.dashboard,
  });
}

// compares the two most recent completed runs. a comparison needs a baseline, so
// this is empty until two runs exist rather than inventing one side of it.
export function useLatestComparison() {
  const runs = useCompletedRuns(2);
  const [scenario, baseline] = runs.data?.data ?? [];

  const comparison = useQuery({
    queryKey:
      scenario && baseline
        ? queryKeys.planning.compare(scenario.id, baseline.id)
        : queryKeys.planning.compare("none", "none"),
    queryFn: () => compareRuns(scenario!.id, baseline!.id),
    enabled: Boolean(scenario && baseline),
    staleTime: STALE_TIME.dashboard,
  });

  return {
    ...comparison,
    isPending: runs.isPending || (Boolean(scenario && baseline) && comparison.isPending),
    completedRunCount: runs.data?.meta.total ?? 0,
    hasTwoRuns: Boolean(scenario && baseline),
  };
}

// the outcome of the most recent completed run, which is what "current state" means
// anywhere the ui puts a plan next to a scenario
export function useLatestRunOutcome() {
  const runs = useCompletedRuns(1);
  const runId = runs.data?.data[0]?.id ?? null;

  const simulation = useQuery({
    queryKey: queryKeys.planning.simulation(runId ?? "none"),
    queryFn: () => getRunSimulation(runId!),
    enabled: Boolean(runId),
    staleTime: STALE_TIME.dashboard,
  });

  const optimization = useQuery({
    queryKey: queryKeys.planning.optimization(runId ?? "none"),
    queryFn: () => getRunOptimization(runId!),
    enabled: Boolean(runId),
    staleTime: STALE_TIME.dashboard,
  });

  return {
    runId,
    simulation: simulation.data ?? null,
    optimization: optimization.data ?? null,
    isPending:
      runs.isPending || (Boolean(runId) && (simulation.isPending || optimization.isPending)),
    hasRun: Boolean(runId),
  };
}
