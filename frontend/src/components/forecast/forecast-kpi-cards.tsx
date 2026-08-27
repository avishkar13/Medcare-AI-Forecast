"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useForecastKpi, useForecastSummary } from "@/hooks/use-forecast";
import { useModelMetrics } from "@/hooks/use-models";
import { LineChart, Target, ShieldCheck, ArrowUpRight, Activity } from "lucide-react";
import { useForecastScope } from "@/store/filters.store";
import { QueryError } from "@/components/ui/query-state";

export function ForecastKpiCards() {
  const scope = useForecastScope();
  const { data, isPending, isError } = useForecastKpi(scope);
  const { data: summary } = useForecastSummary(scope);
  const { data: metrics } = useModelMetrics();

  const kpis = {
    forecastedDemand: data?.forecastedDemand ?? 0,
    forecastHorizonDays: data?.forecastHorizonDays ?? 0,
    forecastAccuracy: data?.forecastAccuracy ?? null,
    // there is no prior scoring period to compare an accuracy figure against
    accuracyChange: null,
    // what the band is actually worth: how often p10-p90 covered the holdout
    confidenceLevel: metrics?.quantile_forecasting.P10_P90_coverage_percent ?? null,
    expectedPeakDemand: data?.expectedPeakDemand ?? 0,
    peakDate: data?.peakDate ?? "",
    demandGrowth: summary?.trendChangePercent ?? null,
  };

  // a null figure has no backend source yet; a dash beats "null%"
  const pct = (value: number | null) => (value === null ? "—" : `${value}%`);
  const signed = (value: number | null) =>
    value === null ? "—" : `${value >= 0 ? "+" : ""}${value}%`;

  if (isPending) return null;

  if (isError) return <QueryError label="the forecast KPIs" />;
  
  const cards = [
    {
      title: "Forecasted Demand",
      value: `${kpis.forecastedDemand.toLocaleString()} units`,
      sub: `Next ${kpis.forecastHorizonDays} days`,
      icon: <LineChart className="h-5 w-5 text-ai" />,
      highlight: true
    },
    {
      title: "Forecast Accuracy",
      value: pct(kpis.forecastAccuracy),
      sub: kpis.accuracyChange === null ? "no prior period to compare" : `${signed(kpis.accuracyChange)} vs previous period`,
      icon: <Target className="h-5 w-5 text-success" />,
      highlight: false
    },
    {
      title: "Band Coverage",
      value: kpis.confidenceLevel === null ? "—" : `${kpis.confidenceLevel.toFixed(1)}%`,
      sub: "p10-p90 covered on holdout",
      icon: <ShieldCheck className="h-5 w-5 text-ai" />,
      highlight: false
    },
    {
      title: "Expected Peak",
      value: `${kpis.expectedPeakDemand} units/day`,
      sub: kpis.peakDate,
      icon: <Activity className="h-5 w-5 text-warning" />,
      highlight: false
    },
    {
      title: "Demand Growth",
      value: signed(kpis.demandGrowth),
      sub: "second half of horizon vs first",
      icon: <ArrowUpRight className="h-5 w-5 text-destructive" />, // using destructive color to imply growing demand might cause stockout risk, or just success. Let's stick to standard colors.
      highlight: false
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((c, i) => (
        <Card key={i} className={c.highlight ? "border-ai/50 shadow-sm bg-ai/5" : ""}>
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start mb-2">
              <span className="text-sm font-medium text-muted-foreground">{c.title}</span>
              <div className="p-1.5 rounded-md bg-background shadow-sm border border-border/50">
                {c.icon}
              </div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${c.highlight ? 'text-ai' : 'text-foreground'}`}>
                {c.value}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
