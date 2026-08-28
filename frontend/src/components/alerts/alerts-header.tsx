"use client";

import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/ui/export-button";
import { RadarIcon, CheckCircle2, Loader2 } from "lucide-react";
import { useAlertOverview, useRefreshAlerts } from "@/hooks/use-alerts";
import { useReadiness } from "@/hooks/use-health";
import { useRealtime } from "@/providers/realtime-provider";

interface AlertsHeaderProps {
  onMarkAllRead: () => void;
  isFetching?: boolean;
  /** The page's live filters, so the export matches what is on screen. */
  exportParams?: Record<string, string | number | boolean | null | undefined>;
}

export function AlertsHeader({
  onMarkAllRead,
  isFetching = false,
  exportParams,
}: AlertsHeaderProps) {
  const overview = useAlertOverview();
  const { data: readiness } = useReadiness();
  const { isLive } = useRealtime();
  const detect = useRefreshAlerts();

  const monitoring = readiness?.dependencies.database === "up";
  const lastUpdated = overview.dataUpdatedAt
    ? new Date(overview.dataUpdatedAt).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="mb-2 flex flex-col justify-between gap-4 pt-4 sm:pt-6 md:flex-row md:items-end">
      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-ai">
          {isLive ? "Live monitoring" : "Real-time monitoring"}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Alerts &amp; Monitoring</h1>
        <p className="mt-1 max-w-2xl text-sm font-medium text-muted-foreground">
          Monitor inventory, demand, expiry, and supply-chain risks requiring immediate attention.
        </p>
      </div>

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center md:gap-4">
        <div className="flex items-center gap-2 rounded-full border border-border/50 bg-background px-3 py-1.5 shadow-sm">
          <div className="relative flex h-2 w-2">
            {monitoring && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            )}
            <span
              className={`relative inline-flex h-2 w-2 rounded-full ${monitoring ? "bg-success" : "bg-destructive"}`}
            />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {/* Three states, not two: the backend can be up while the push channel is not. */}
            {!monitoring ? "Monitoring down" : isLive ? "Live" : "Polling"}
          </span>
        </div>

        <p className="hidden whitespace-nowrap text-[11px] font-semibold text-muted-foreground sm:block">
          {lastUpdated ? `Last updated: ${lastUpdated}` : "Not loaded"}
        </p>

        <div className="flex items-center gap-2">
          {/*
            Runs a real detection cycle rather than refetching the cache. A refetch
            only re-reads rows that nothing has re-derived, which is why the table
            could sit unchanged however many times it was pressed.
          */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 cursor-pointer bg-background text-xs font-semibold"
            onClick={() => detect.mutate()}
            disabled={detect.isPending || isFetching}
          >
            {detect.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RadarIcon className="mr-1.5 h-3.5 w-3.5" />
            )}
            {detect.isPending ? "Detecting…" : "Run detection"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 cursor-pointer bg-background text-xs font-semibold"
            onClick={onMarkAllRead}
          >
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
            Mark All Read
          </Button>
          {/* E1 output 1: the low-stock alert log. */}
          <ExportButton
            path="/alerts/export"
            fallbackName="low-stock-alert-log.csv"
            label="alerts"
            {...(exportParams ? { params: exportParams } : {})}
          />
        </div>
      </div>
    </div>
  );
}
