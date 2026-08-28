"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/ui/export-button";
import { RefreshCw } from "lucide-react";
import { queryKeys } from "@/config/query-keys";
import { useCompletedRuns } from "@/hooks/use-planning";
import { useRecommendationKpi } from "@/hooks/use-recommendations";

export function RecommendationsHeader() {
  const client = useQueryClient();
  const kpi = useRecommendationKpi();
  const runs = useCompletedRuns(1);

  // recommendations come out of a planning run, so "last analyzed" is when that run
  // finished rather than when this page fetched
  const analyzedAt = runs.data?.data[0]?.completedAt ?? null;

  const handleRefresh = () => {
    void client.invalidateQueries({ queryKey: queryKeys.recommendations.all });
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 sm:pt-6 mb-2">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Recommendations</h1>
        <p className="text-sm text-muted-foreground mt-1 font-medium">
          AI-prescribed actions to optimize inventory and prevent stockouts.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <p className="text-xs font-medium text-muted-foreground whitespace-nowrap">
          {analyzedAt
            ? `Last analyzed: ${new Date(analyzedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
            : "No completed run yet"}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="bg-background"
          onClick={handleRefresh}
          disabled={kpi.isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${kpi.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        {/* E1 output 3: the reorder action summary. */}
        <ExportButton
          path="/recommendations/export"
          fallbackName="reorder-action-summary.csv"
          label="recommendations"
        />
      </div>
    </div>
  );
}
