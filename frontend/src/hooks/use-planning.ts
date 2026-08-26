"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/config/query-keys";
import { STALE_TIME } from "@/config/constants";
import { compareRuns, listRuns } from "@/lib/api/planning";

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
