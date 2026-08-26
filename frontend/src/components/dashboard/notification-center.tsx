"use client";

import Link from "next/link";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAlertActions, useAlertOverview, useAlerts } from "@/hooks/use-alerts";
import { useRealtime } from "@/providers/realtime-provider";
import { cn } from "@/lib/utils";
import type { SystemAlert } from "@/types/alert";

/**
 * The bell.
 *
 * It used to be a Tooltip that reported a count and could not be opened, so the only
 * route to an alert was the Alerts page. This is the review surface at the top level:
 * what fired, how bad, where, and a way in.
 *
 * The badge prefers the pushed count over the fetched one - a socket event lands
 * before the overview query refetches, and a badge that lags the toast by a refetch
 * looks broken.
 */

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-destructive",
  high: "bg-orange-500",
  medium: "bg-amber-500",
  low: "bg-muted-foreground",
};

const relativeTime = (iso: string): string => {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

/** Context travels with the link so the page opens already scoped to what fired. */
const alertHref = (alert: SystemAlert & { warehouseId?: string | null }) => {
  const params = new URLSearchParams();
  if (alert.warehouseId) params.set("dc", alert.warehouseId);
  if (alert.sku) params.set("sku", alert.sku);
  const query = params.toString();
  return query ? `/alerts?${query}` : "/alerts";
};

export function NotificationCenter() {
  const { counts, isLive } = useRealtime();
  const { data: overview } = useAlertOverview();
  const { data, isPending, isError } = useAlerts({ status: "open", pageSize: 6 });
  const { markAllRead } = useAlertActions();

  const unresolved = counts?.unresolved ?? overview?.unresolvedCount ?? 0;
  const critical = counts?.critical ?? overview?.criticalCount ?? 0;
  const alerts = data?.data ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="relative h-9 w-9 cursor-pointer" />}
      >
        <Bell className="h-4 w-4 text-muted-foreground" />
        {unresolved > 0 && (
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white",
              critical > 0 ? "bg-destructive" : "bg-orange-500",
            )}
          >
            {unresolved > 99 ? "99+" : unresolved}
          </span>
        )}
        <span className="sr-only">
          {unresolved > 0 ? `${unresolved} unresolved alerts` : "No unresolved alerts"}
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-[380px] p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Alerts</span>
            {/* Says whether what follows is live or on a 30s interval. */}
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                isLive ? "bg-success" : "bg-muted-foreground/40",
              )}
              title={isLive ? "Live" : "Polling"}
            />
          </div>
          {unresolved > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs cursor-pointer"
              disabled={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              {markAllRead.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCheck className="h-3 w-3" />
              )}
              Mark all read
            </Button>
          )}
        </div>

        <DropdownMenuSeparator className="m-0" />

        {isPending ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading alerts…</p>
        ) : isError ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Could not load alerts.
          </p>
        ) : alerts.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Nothing needs attention.
          </p>
        ) : (
          <ScrollArea className="max-h-[320px]">
            {alerts.map((alert) => (
              <Link
                key={alert.id}
                href={alertHref(alert)}
                className="flex gap-3 border-b border-border/50 px-4 py-3 last:border-0 hover:bg-muted/50"
              >
                <span
                  className={cn(
                    "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                    SEVERITY_DOT[alert.severity] ?? SEVERITY_DOT.low,
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{alert.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {alert.location}
                    {alert.sku ? ` · ${alert.sku}` : ""} · {relativeTime(alert.detectedAt)}
                  </p>
                </div>
              </Link>
            ))}
          </ScrollArea>
        )}

        <DropdownMenuSeparator className="m-0" />
        <Link
          href="/alerts"
          className="block px-4 py-2.5 text-center text-xs font-medium text-primary hover:bg-muted/50"
        >
          View all alerts
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
