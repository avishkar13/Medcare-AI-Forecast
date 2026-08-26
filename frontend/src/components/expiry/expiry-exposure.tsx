"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useExpiryExposure } from "@/hooks/use-expiry";
import { formatCompactCurrency } from "@/lib/utils";

const WINDOW_COLORS = ["bg-destructive", "bg-warning", "bg-primary", "bg-muted-foreground/30"];

const RISK_DOT = {
  critical: "bg-destructive",
  high: "bg-warning",
  medium: "bg-primary",
  low: "bg-muted-foreground/40",
} as const;

export function ExpiryExposure() {
  const { data, isPending } = useExpiryExposure();

  if (isPending || !data) return null;

  return (
    <Card className="border-border/60 shadow-sm mb-6 bg-background">
      <CardHeader className="pb-4 border-b border-border/50">
        <CardTitle className="text-sm font-bold flex flex-col gap-1">
          <span className="text-base">Expiry Exposure</span>
          <span className="text-[10px] font-medium text-muted-foreground normal-case">
            Inventory value and quantity approaching expiry.
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/50">

          <div className="p-6">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-6">
              Value by Expiry Window
            </h3>
            <div className="space-y-4">
              {data.byWindow.map((item, index) => (
                <div key={item.label} className="flex items-center gap-4">
                  <div className="w-20 text-[10px] font-bold text-muted-foreground whitespace-nowrap">
                    {item.label}
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="w-full bg-muted/20 h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${WINDOW_COLORS[index % WINDOW_COLORS.length]} transition-all duration-500`}
                        style={{ width: `${item.sharePercent}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-foreground w-14 text-right">
                      {formatCompactCurrency(item.value)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 bg-muted/5 flex flex-col justify-center">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-6">
              Expiry Risk Breakdown
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              {data.byRisk.map((item) => (
                <div key={item.level} className="flex flex-col gap-1 p-3 bg-background border border-border/50 rounded-lg">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className={`h-2 w-2 rounded-full ${RISK_DOT[item.level]}`} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{item.level}</span>
                  </div>
                  <span className="text-sm font-black text-foreground">{formatCompactCurrency(item.value)}</span>
                  <span className="text-[9px] font-medium text-muted-foreground">{item.batchCount} batches</span>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-border/50 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Exposure</span>
              <span className="text-xl font-black text-foreground">{formatCompactCurrency(data.totalExposureValue)}</span>
            </div>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}
