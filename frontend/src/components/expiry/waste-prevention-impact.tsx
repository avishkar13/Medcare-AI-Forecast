"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown, Coins } from "lucide-react";
import { useExpiryOverview, useWastePrevention } from "@/hooks/use-expiry";
import { useFormatters } from "@/hooks/use-formatters";
import { QueryError } from "@/components/ui/query-state";

const BAR_SHADES = ["bg-success", "bg-success/80", "bg-success/60", "bg-success/40"];

export function WastePreventionImpact() {
  const { data: prevention, isPending, isError } = useWastePrevention();
  const { data: overview } = useExpiryOverview();

  const breakdown = (prevention?.byAction ?? []).slice(0, 4).map((row, index) => ({
    label: row.actionTaken,
    value: row.valueSaved,
    sharePercent: row.sharePercent,
    color: BAR_SHADES[index]!,
  }));
  const { formatCompactCurrency: formatCurrency, formatNumber } = useFormatters();

  if (isPending) return null;

  if (isError) return <QueryError label="waste prevention" />;

  return (
    <Card className="border-border/60 shadow-sm bg-gradient-to-br from-background via-background to-success/5 h-full flex flex-col">
      <CardHeader className="pb-4 border-b border-border/50">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Coins className="h-4 w-4 text-muted-foreground" />
          Waste Prevention Opportunity
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-6 flex-1 flex flex-col">
        {/* Top Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="flex flex-col">
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Value at Risk</span>
            <span className="text-lg font-black text-foreground">{formatCurrency(overview?.totalAtRiskValue ?? 0)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Value Saved</span>
            <span className="text-lg font-black text-success flex items-center gap-1"><TrendingDown className="h-4 w-4" /> {formatCurrency(prevention?.totalValueSaved ?? 0)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Units Saved</span>
            <span className="text-lg font-black text-foreground">{formatNumber(prevention?.totalUnitsSaved ?? 0)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Critical Exposure</span>
            <span className="text-lg font-black text-destructive">{formatCurrency(overview?.criticalAtRiskValue ?? 0)}</span>
          </div>
        </div>

        <div className="h-px w-full bg-border/50 mb-6" />

        {/* Breakdown Bars */}
        <div className="flex-1 flex flex-col justify-center">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Savings by Action</h4>
          {breakdown.length === 0 && (
            <p className="text-xs font-medium text-muted-foreground">
              No waste prevention has been recorded yet.
            </p>
          )}
          <div className="space-y-4">
            {breakdown.map((item, idx) => {
              const widthPct = item.sharePercent;
              return (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-32 text-xs font-semibold text-foreground truncate">
                    {item.label}
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="w-full bg-muted/20 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${item.color} transition-all duration-500`} 
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-foreground w-12 text-right">
                      {formatCurrency(item.value)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
