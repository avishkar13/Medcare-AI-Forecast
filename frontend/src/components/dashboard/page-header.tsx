"use client";

import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { queryKeys } from "@/config/query-keys";
import { useDashboardSummary } from "@/hooks/use-dashboard";

export function PageHeader() {
  const client = useQueryClient();
  const summary = useDashboardSummary();

  // when the figures below were fetched, not when this header rendered
  const lastUpdated = summary.dataUpdatedAt
    ? new Date(summary.dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border mb-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Supply Chain Command Center</h1>
        <p className="text-sm text-muted-foreground">
          AI-driven inventory and replenishment intelligence
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground font-medium" suppressHydrationWarning>
          {lastUpdated ? `Last updated: ${lastUpdated}` : "Not loaded"}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-2 cursor-pointer"
          onClick={() => void client.invalidateQueries({ queryKey: queryKeys.dashboard.all })}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${summary.isFetching ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </Button>
      </div>
    </div>
  );
}
