"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useForecastSeasonality, useForecastTrend } from "@/hooks/use-forecast";
import { BarChart3, TrendingUp, TrendingDown, Minus, Calendar, Zap } from "lucide-react";
import { useForecastScope } from "@/store/filters.store";
import { QueryError } from "@/components/ui/query-state";

function TrendIcon({ val }: { val: number | null }) {
  if (val === null || val === 0) return <Minus className="h-4 w-4 text-muted-foreground" />;
  if (val > 0) return <TrendingUp className="h-4 w-4 text-destructive" />;
  return <TrendingDown className="h-4 w-4 text-ai" />;
}

const formatTrendStr = (val: number | null) => {
  if (val === null) return "—";
  if (val === 0) return "0%";
  return val > 0 ? `+${val}%` : `${val}%`;
};

export function ForecastTrend() {
  const scope = useForecastScope();
  const { data, isPending, isError } = useForecastTrend(scope);
  const seasonality = useForecastSeasonality(scope);

  // the peak weekday, taken from the measured index rather than described in prose
  const peak = (seasonality.data?.weeklyPattern ?? []).reduce<
    { label: string | number; index: number } | null
  >((best, day) => (best === null || day.index > best.index ? day : best), null);

  const trends = {
    sevenDayTrend: data?.sevenDayTrend ?? null,
    thirtyDayTrend: data?.thirtyDayTrend ?? null,
    seasonalPattern: peak ? `Weekly (${peak.label} peak)` : "",
    growthRate: data?.thirtyDayTrend ?? null,
    demandVolatility: data?.demandVolatility ?? "",
  };

  if (isPending) return null;

  if (isError) return <QueryError label="demand trends" />;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          Demand Trend Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-y-6 gap-x-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">7-Day Trend</p>
            <div className="flex items-center gap-1.5">
              <TrendIcon val={trends.sevenDayTrend} />
              <span className="text-lg font-semibold">{formatTrendStr(trends.sevenDayTrend)}</span>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">30-Day Trend</p>
            <div className="flex items-center gap-1.5">
              <TrendIcon val={trends.thirtyDayTrend} />
              <span className="text-lg font-semibold">{formatTrendStr(trends.thirtyDayTrend)}</span>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Seasonal Pattern</p>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-ai" />
              <span className="text-sm font-semibold">{trends.seasonalPattern}</span>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Volatility</p>
            <div className="flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-success" />
              <span className="text-sm font-semibold">{trends.demandVolatility}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
