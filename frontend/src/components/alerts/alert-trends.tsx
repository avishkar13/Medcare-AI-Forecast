"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown } from "lucide-react";

export function AlertTrends() {
  // Simple CSS-based bar chart for mock representation
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const data = [
    { critical: 4, high: 6, med: 10, low: 8 },
    { critical: 5, high: 8, med: 12, low: 10 },
    { critical: 3, high: 7, med: 14, low: 12 },
    { critical: 6, high: 9, med: 11, low: 9 },
    { critical: 2, high: 5, med: 8, low: 15 },
    { critical: 1, high: 4, med: 7, low: 6 },
    { critical: 3, high: 7, med: 12, low: 18 },
  ];

  const maxTotal = Math.max(...data.map(d => d.critical + d.high + d.med + d.low));

  return (
    <Card className="border-border/60 shadow-sm h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          Alert Trends (Last 7 Days)
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between">
        
        <div className="flex gap-2 h-32 mt-2 w-full">
          {data.map((day, idx) => {
            const total = day.critical + day.high + day.med + day.low;
            const cPct = (day.critical / total) * 100;
            const hPct = (day.high / total) * 100;
            const mPct = (day.med / total) * 100;
            const lPct = (day.low / total) * 100;
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
          <div className="p-1.5 rounded-md bg-success/10 text-success shrink-0">
            <TrendingDown className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-foreground">Critical alerts decreased 18%</p>
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">compared with the previous 7 days.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
