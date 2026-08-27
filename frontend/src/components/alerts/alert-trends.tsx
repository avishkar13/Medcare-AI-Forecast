"use client";

import { useAlertTrends } from "@/hooks/use-alerts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown, TrendingUp } from "lucide-react";
import { QueryError } from "@/components/ui/query-state";

export function AlertTrends() {
  // fourteen days so the api has a previous half to compare the recent one against
  const { data: trends, isPending, isError } = useAlertTrends(14);

  const comparison = trends?.comparison;
  const recent = (trends?.points ?? []).slice(-(comparison?.halfWindowDays ?? 7));

  const days = recent.map((point) =>
    new Date(point.date).toLocaleDateString("en-US", { weekday: "short" }),
  );
  const data = recent.map((point) => ({
    critical: point.critical,
    high: point.high,
    med: point.medium,
    low: point.low,
  }));

  const criticalChange = comparison?.criticalChangePercent ?? null;
  const improving = criticalChange !== null && criticalChange <= 0;

  const maxTotal = Math.max(1, ...data.map((d) => d.critical + d.high + d.med + d.low));

  if (isPending) return null;

  if (isError) return <QueryError label="alert trends" />;

  return (
    <Card className="border-border/60 shadow-sm h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          Alert Trends (Last {comparison?.halfWindowDays ?? 7} Days)
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between">
        
        <div className="flex gap-2 h-32 mt-2 w-full">
          {data.map((day, idx) => {
            const total = day.critical + day.high + day.med + day.low;
            const share = (count: number) => (total === 0 ? 0 : (count / total) * 100);
            const cPct = share(day.critical);
            const hPct = share(day.high);
            const mPct = share(day.med);
            const lPct = share(day.low);
            const heightPct = (total / maxTotal) * 100;
            
            return (
              <div key={idx} className="flex-1 h-full flex flex-col items-center justify-end gap-2 group">
                <div className="w-full relative bg-muted/20 rounded-sm overflow-hidden flex flex-col justify-end transition-all duration-300" style={{ height: `${heightPct}%` }}>
                  <div className="w-full bg-destructive transition-all duration-300" style={{ height: `${cPct}%` }} />
                  <div className="w-full bg-warning transition-all duration-300" style={{ height: `${hPct}%` }} />
                  <div className="w-full bg-primary transition-all duration-300" style={{ height: `${mPct}%` }} />
                  <div className="w-full bg-muted-foreground/30 transition-all duration-300" style={{ height: `${lPct}%` }} />
                </div>
                <span className="text-[9px] font-bold uppercase text-muted-foreground group-hover:text-foreground">{days[idx]}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-border/50 flex items-start gap-3">
          <div className={`p-1.5 rounded-md shrink-0 ${improving ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
            {improving ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
          </div>
          <div>
            <p className="text-xs font-bold text-foreground">
              {criticalChange === null
                ? `${comparison?.currentCritical ?? 0} critical alerts in the last ${comparison?.halfWindowDays ?? 7} days`
                : `Critical alerts ${criticalChange <= 0 ? "decreased" : "increased"} ${Math.abs(criticalChange)}%`}
            </p>
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
              {criticalChange === null
                ? "nothing was raised in the period before that."
                : `compared with the previous ${comparison?.halfWindowDays ?? 7} days.`}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
