"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useForecastKpi, useForecastSummary } from "@/hooks/use-forecast";
import { useFormatters } from "@/hooks/use-formatters";
import { useForecastScope } from "@/store/filters.store";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  Info,
  ShieldCheck,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { QueryError } from "@/components/ui/query-state";

export function ForecastSummaryPanel() {
  const scope = useForecastScope();
  const { data, isPending, isError } = useForecastSummary(scope);
  const kpi = useForecastKpi(scope);
  const { formatDate } = useFormatters();

  const summary = {
    predictedPeak: kpi.data?.expectedPeakDemand ?? 0,
    peakDate: kpi.data?.peakDate ?? "",
    avgDailyDemand: data?.averageDailyDemand ?? 0,
    minExpectedDemand: data?.minExpectedDemand ?? 0,
    maxExpectedDemand: data?.maxExpectedDemand ?? 0,
    confidenceRange: data?.confidenceRange ?? ([0, 0] as [number, number]),
    historicalAccuracy: kpi.data?.forecastAccuracy ?? null,
    expectedTrend: data?.expectedTrend ?? "",
  };

  if (isPending) return null;

  if (isError) return <QueryError label="the forecast summary" />;

  const isGrowing = summary.expectedTrend === "Growing";

  return (
    <Card className="relative h-full min-h-0 overflow-hidden border-border/70 bg-gradient-to-b from-ai/[0.045] via-background to-background shadow-sm">
      {/* Ambient AI glow */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-ai/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-48 w-48 rounded-full bg-ai/[0.045] blur-3xl" />

      <CardContent className="relative flex h-full min-h-0 flex-col p-0">
        {/* =========================
            HEADER
        ========================== */}
        <div className="flex shrink-0 items-start justify-between border-b border-border/60 px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Forecast Summary
            </p>

            <div className="mt-2 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-ai/20 bg-ai/10">
                <Zap className="h-4 w-4 text-ai" />
              </div>

              <div>
                <p className="text-sm font-semibold text-foreground">
                  AI Demand Outlook
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Model-generated forecast
                </p>
              </div>
            </div>
          </div>

          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-background/70 text-muted-foreground transition-colors hover:border-ai/30 hover:bg-ai/5 hover:text-ai"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              }
            />

            <TooltipContent>
              Forecast metrics generated from historical demand patterns.
            </TooltipContent>
          </Tooltip>
        </div>

        {/* =========================
            SCROLLABLE CONTENT
        ========================== */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 [scrollbar-width:thin]">
          <div className="flex flex-col gap-5">
            {/* =========================
                FORECAST TIMESTAMP
            ========================== */}
            <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/70 px-3.5 py-3 shadow-sm">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/30">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Expected Peak Date
                </p>

                <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
                  {formatDate(summary.peakDate)}
                </p>
              </div>
            </div>

            {/* =========================
                PRIMARY KPI
            ========================== */}
            <div className="relative overflow-hidden rounded-2xl border border-ai/20 bg-gradient-to-br from-ai/[0.09] via-ai/[0.035] to-background p-4 shadow-sm">
              <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-ai/10 blur-2xl" />

              <div className="relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ai/80">
                      Avg Daily Demand
                    </p>

                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Expected daily requirement
                    </p>
                  </div>

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-ai/20 bg-background/80 shadow-sm">
                    <Activity className="h-5 w-5 text-ai" />
                  </div>
                </div>

                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-4xl font-bold tracking-tight text-foreground">
                    {summary.avgDailyDemand}
                  </span>

                  <span className="text-sm font-medium text-muted-foreground">
                    units
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-ai">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>Demand remains elevated</span>
                </div>
              </div>
            </div>

            {/* =========================
                MIN / MAX
            ========================== */}
            <div className="grid grid-cols-2 gap-3">
              {/* Minimum */}
              <div className="group rounded-xl border border-border/70 bg-background/75 p-3.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-ai/25 hover:shadow-md">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Min Expected
                  </p>

                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-ai/10">
                    <ArrowDown className="h-3 w-3 text-ai" />
                  </div>
                </div>

                <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                  {summary.minExpectedDemand}
                </p>

                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  units / day
                </p>
              </div>

              {/* Maximum */}
              <div className="group rounded-xl border border-border/70 bg-background/75 p-3.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-destructive/25 hover:shadow-md">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Max Expected
                  </p>

                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10">
                    <ArrowUp className="h-3 w-3 text-destructive" />
                  </div>
                </div>

                <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                  {summary.maxExpectedDemand}
                </p>

                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  units / day
                </p>
              </div>
            </div>

            {/* =========================
                CONFIDENCE RANGE
            ========================== */}
            <div className="border-t border-border/60 pt-6 mt-2">
              <div className="mb-2.5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Confidence Range
                  </p>

                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    p10-p90 band, an 80% interval
                  </p>
                </div>

                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    }
                  />

                  <TooltipContent>
                    The model publishes a p10-p90 band, so actual demand falls in this
                    range about 80% of the time.
                  </TooltipContent>
                </Tooltip>
              </div>

              <div className="relative overflow-hidden rounded-xl border border-ai/15 bg-ai/[0.035] p-2">
                <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-ai/[0.04] to-transparent" />

                <div className="relative flex items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-ai/20 bg-background/80">
                    <ShieldCheck className="h-4.5 w-4.5 text-ai" />
                  </div>

                  <div className="flex min-w-0 flex-1 items-center justify-center">
                    <span className="text-md font-bold tracking-tight text-foreground">
                      {summary.confidenceRange[0]}
                    </span>

                    <div className="mx-2 flex flex-1 items-center gap-2">
                      <div className="h-px flex-1 bg-border" />

                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ai" />

                      <div className="h-px flex-1 bg-border" />
                    </div>

                    <span className="text-md font-bold tracking-tight text-foreground">
                      {summary.confidenceRange[1]}
                    </span>
                  </div>
                </div>

                <div className="relative mt-2.5 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Lower bound</span>
                  <span>Upper bound</span>
                </div>
              </div>
            </div>

            {/* =========================
                ACCURACY / TREND
            ========================== */}
            <div className="grid grid-cols-2 gap-3 border-t border-border/60 pt-6 mt-2">
              {/* Historical accuracy */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Hist. Accuracy
                  </p>

                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          className="text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <Info className="h-3 w-3" />
                        </button>
                      }
                    />

                    <TooltipContent>
                      Historical accuracy of the forecasting model.
                    </TooltipContent>
                  </Tooltip>
                </div>

                <div className="flex min-h-[52px] items-center gap-2.5 rounded-xl border border-border/70 bg-background/75 px-3 py-2 shadow-sm">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success/10">
                    <Target className="h-3.5 w-3.5 text-success" />
                  </div>

                  <div>
                    <p className="text-base font-bold text-foreground">
                      {summary.historicalAccuracy === null ? "—" : `${summary.historicalAccuracy}%`}
                    </p>

                    <p className="text-[9px] text-muted-foreground">
                      model accuracy
                    </p>
                  </div>
                </div>
              </div>

              {/* Expected trend */}
              <div>
                <div className="mb-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Expected Trend
                  </p>
                </div>

                <div className="flex min-h-[52px] items-center justify-between gap-2 rounded-xl border border-border/70 bg-background/75 px-3 py-2 shadow-sm">
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-foreground">
                      {summary.expectedTrend}
                    </p>

                    <p className="text-[9px] text-muted-foreground">
                      forecast direction
                    </p>
                  </div>

                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                      isGrowing
                        ? "border-destructive/20 bg-destructive/10"
                        : "border-ai/20 bg-ai/10"
                    }`}
                  >
                    {isGrowing ? (
                      <TrendingUp className="h-3.5 w-3.5 text-destructive" />
                    ) : (
                      <ArrowDown className="h-3.5 w-3.5 text-ai" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* =========================
                PEAK INFORMATION
            ========================== */}
            <div className="mt-2 rounded-xl border border-border/60 bg-muted/[0.18] px-3.5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Predicted Peak
                  </p>

                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {summary.predictedPeak} units
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Peak Date
                  </p>

                  <p className="mt-1 text-xs font-medium text-foreground">
                    {formatDate(summary.peakDate)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =========================
            FOOTER STATUS
        ========================== */}
        <div className="flex shrink-0 items-center justify-between border-t border-border/60 bg-muted/[0.12] px-5 py-2.5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              {data?.planningRunId && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ai/60" />
              )}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${data?.planningRunId ? "bg-ai" : "bg-muted-foreground"}`} />
            </span>

            <span className="text-[10px] font-medium text-muted-foreground">
              {data?.modelVersion ?? "No forecast run"}
            </span>
          </div>

          <span className="text-[10px] font-medium text-muted-foreground">
            80% interval
          </span>
        </div>
      </CardContent>
    </Card>
  );
}