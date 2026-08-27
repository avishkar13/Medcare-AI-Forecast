"use client";

import Link from "next/link";
import { Activity, ArrowDownRight, ArrowUpRight, Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QueryErrorInline } from "@/components/ui/query-state";
import { useMovements } from "@/hooks/use-movements";
import { useScopedHref } from "@/hooks/use-scope";
import { useFormatters } from "@/hooks/use-formatters";
import { useRealtime } from "@/providers/realtime-provider";

const RECENT = 8;

/**
 * What just happened at this DC. Phase 3.8.
 *
 * **How live this actually is.** Recording a movement invalidates this query, so the
 * person doing it sees their own action immediately. For *other* viewers it refreshes
 * on the alert events the Phase 1 socket already pushes - detection runs after every
 * movement, so anything that raises an alert propagates at once. A movement that
 * raises nothing reaches them on the poll below.
 *
 * Closing that last gap needs a `movement:*` event on the socket, which lives in the
 * Phase 1 realtime module. It is a small addition and deliberately not made here.
 */
export function LiveActivity() {
  const { isLive } = useRealtime();
  const scopedHref = useScopedHref();
  const { formatNumber } = useFormatters();

  const { data, isPending, isError } = useMovements({ pageSize: RECENT });
  const rows = data?.data ?? [];

  return (
    <Card className="flex h-full flex-col shadow-sm">
      <CardHeader className="border-b border-border/50 pb-4">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Activity className="h-4 w-4 text-primary" />
          Live Activity
          <span className="ml-auto flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
            <span className="relative flex h-2 w-2">
              {isLive && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              )}
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  isLive ? "bg-success" : "bg-muted-foreground/40"
                }`}
              />
            </span>
            {isLive ? "Live" : "Polling"}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        {isError ? (
          <div className="px-4">
            <QueryErrorInline label="recent activity" />
          </div>
        ) : isPending ? (
          <p className="p-4 text-sm text-muted-foreground">Loading activity…</p>
        ) : rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            Nothing has moved yet. Recording a movement starts the feed.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-border/50">
            {rows.map((row) => {
              const outward = row.quantity < 0;
              return (
                <div key={row.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      outward ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
                    }`}
                  >
                    {outward ? (
                      <ArrowDownRight className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center gap-2">
                      <Link
                        href={scopedHref("/inventory", { sku: row.sku })}
                        className="truncate text-sm font-medium text-foreground hover:underline"
                      >
                        {row.sku}
                      </Link>
                      <Badge variant="outline" className="text-[9px] font-semibold">
                        {row.movementType.replace(/_/g, " ")}
                      </Badge>
                      {row.triggeredAlertId && (
                        <Link
                          href={scopedHref("/alerts", { sku: row.sku, dc: row.warehouseId })}
                          title="This movement raised an alert"
                          className="text-warning"
                        >
                          <Bell className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {row.dc} · {new Date(row.date).toLocaleTimeString()} ·{" "}
                      {formatNumber(row.stockBefore)} → {formatNumber(row.stockAfter)}
                    </span>
                  </div>

                  <span
                    className={`shrink-0 text-sm font-semibold ${
                      outward ? "text-destructive" : "text-success"
                    }`}
                  >
                    {outward ? "−" : "+"}
                    {formatNumber(Math.abs(row.quantity))}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
