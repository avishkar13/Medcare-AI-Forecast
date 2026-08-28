"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QueryErrorInline } from "@/components/ui/query-state";
import { useRunOutcome } from "@/hooks/use-planning";
import { useFormatters } from "@/hooks/use-formatters";
import { Target } from "lucide-react";

const percent = (value: number | null) => (value === null ? "—" : `${value.toFixed(1)}%`);

export function PlanVsActual() {
  const { data, isPending, isError, hasRun } = useRunOutcome();
  const { formatCompactCurrency, formatNumber } = useFormatters();

  const header = (
    <CardHeader className="border-b border-border/50 pb-4">
      <CardTitle className="flex items-center gap-2 text-base">
        <Target className="h-4 w-4 text-primary" />
        Plan vs Actual
      </CardTitle>
      <CardDescription>
        What the ledgers recorded, against what the run predicted
      </CardDescription>
    </CardHeader>
  );

  if (isPending || isError || !hasRun || !data) {
    return (
      <Card className="flex flex-col">
        {header}
        <CardContent className="py-8 text-sm text-muted-foreground">
          {isError ? (
            <QueryErrorInline label="the run outcome" />
          ) : isPending ? (
            "Loading…"
          ) : (
            "No completed planning run to score yet."
          )}
        </CardContent>
      </Card>
    );
  }

  // A run an hour old has no elapsed days. Every figure below would be a real zero,
  // which reads as total failure rather than "nothing has happened yet".
  if (!data.hasEvidence) {
    return (
      <Card className="flex flex-col">
        {header}
        <CardContent className="py-8 text-sm text-muted-foreground">
          Scored over {data.window.elapsedDays} of {data.window.horizonDays} days — not
          enough has happened since the run completed to judge it. Record movements and
          this fills in.
        </CardContent>
      </Card>
    );
  }

  const { serviceLevel, cost, demand, window } = data;
  const plannedPercent = serviceLevel.planned === null ? null : serviceLevel.planned * 100;
  const ahead = serviceLevel.delta !== null && serviceLevel.delta >= 0;
  const cheaper = cost.plannedToDate !== null && cost.realised.total <= cost.plannedToDate;

  return (
    <Card className="flex flex-col">
      {header}
      <CardContent className="flex flex-col gap-6 pt-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/50 p-4">
            <span className="text-sm font-medium text-muted-foreground">Service level planned</span>
            <span className="text-2xl font-bold tabular-nums text-foreground">
              {percent(plannedPercent)}
            </span>
          </div>
          <div
            className={`flex flex-col gap-1 rounded-lg border p-4 ${
              ahead ? "border-success/20 bg-success/5" : "border-destructive/20 bg-destructive/5"
            }`}
          >
            <span
              className={`text-sm font-medium ${ahead ? "text-success" : "text-destructive"}`}
            >
              Service level achieved
            </span>
            <span
              className={`text-2xl font-bold tabular-nums ${
                ahead ? "text-success" : "text-destructive"
              }`}
            >
              {percent(serviceLevel.achievedPercent)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/50 p-4">
            <span className="text-sm font-medium text-muted-foreground">Cost planned to date</span>
            <span className="text-2xl font-bold tabular-nums text-foreground">
              {cost.plannedToDate === null ? "—" : formatCompactCurrency(cost.plannedToDate)}
            </span>
          </div>
          <div
            className={`flex flex-col gap-1 rounded-lg border p-4 ${
              cheaper ? "border-success/20 bg-success/5" : "border-warning/20 bg-warning/5"
            }`}
          >
            <span
              className={`text-sm font-medium ${cheaper ? "text-success" : "text-warning"}`}
            >
              Cost incurred
            </span>
            <span
              className={`text-2xl font-bold tabular-nums ${
                cheaper ? "text-success" : "text-warning"
              }`}
            >
              {formatCompactCurrency(cost.realised.total)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs font-medium text-muted-foreground">Unmet</p>
            <p className="text-sm font-bold tabular-nums">{formatNumber(demand.unmetUnits)}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs font-medium text-muted-foreground">Wasted</p>
            <p className="text-sm font-bold tabular-nums">{formatNumber(demand.wasteUnits)}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs font-medium text-muted-foreground">Transferred</p>
            <p className="text-sm font-bold tabular-nums">{formatNumber(demand.transferUnits)}</p>
          </div>
        </div>

        {/* Coverage is the caveat that keeps a partial window from reading as a verdict. */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {window.from} to {window.to} · {formatNumber(demand.orderedUnits)} units ordered
          </p>
          <Badge variant="outline" className="text-[10px] font-semibold">
            {window.elapsedDays}/{window.horizonDays} days scored
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
