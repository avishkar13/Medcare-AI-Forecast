"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DCImpact } from "@/types/simulation";
import { AlertTriangle, ArrowRight } from "lucide-react";

interface DistributionImpactProps {
  dcs: DCImpact[];
}

export function DistributionImpact({ dcs }: DistributionImpactProps) {
  return (
    <Card className="rounded-xl border-border/60 shadow-sm h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold">Distribution Center Impact</CardTitle>
        <p className="text-[10px] text-muted-foreground font-medium">Network capacity and risk under simulation.</p>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {dcs.map((dc) => {
          const capacityBreach = dc.simulatedCapacity > 100;
          const riskIncrease = dc.simulatedStockoutRisk > dc.currentStockoutRisk * 1.5;

          return (
            <div key={dc.name} className={`p-3 rounded-lg border ${capacityBreach ? "border-destructive/30 bg-destructive/5" : "border-border/50 bg-background"}`}>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold text-foreground">{dc.name}</span>
                {capacityBreach && (
                  <div className="flex items-center gap-1 text-[10px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
                    <AlertTriangle className="h-3 w-3" /> Over Capacity
                  </div>
                )}
              </div>

              {/* Capacity bar */}
              <div className="mb-2">
                <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground mb-1">
                  <span>Capacity</span>
                  <span className="tabular-nums">
                    {dc.currentCapacity}% <ArrowRight className="h-2.5 w-2.5 inline" /> <span className={capacityBreach ? "text-destructive font-bold" : "text-ai font-bold"}>{dc.simulatedCapacity}%</span>
                  </span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 shadow-sm ${capacityBreach ? "bg-destructive" : "bg-ai"}`}
                    style={{ width: `${Math.min(dc.simulatedCapacity, 100)}%` }}
                  />
                </div>
              </div>

              {/* Metrics row */}
              <div className="grid grid-cols-2 gap-2">
                <div className="text-[10px]">
                  <span className="text-muted-foreground font-medium">Stockout Risk</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="font-medium tabular-nums">{dc.currentStockoutRisk}%</span>
                    <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                    <span className={`font-bold tabular-nums ${riskIncrease ? "text-destructive" : "text-foreground"}`}>{dc.simulatedStockoutRisk}%</span>
                  </div>
                </div>
                <div className="text-[10px] text-right">
                  <span className="text-muted-foreground font-medium">At-Risk Value</span>
                  <div className="flex items-center gap-1 mt-0.5 justify-end">
                    <span className="font-medium tabular-nums">${(dc.currentAtRiskValue / 1000).toFixed(0)}K</span>
                    <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                    <span className={`font-bold tabular-nums ${dc.simulatedAtRiskValue > dc.currentAtRiskValue * 1.5 ? "text-destructive" : "text-foreground"}`}>
                      ${(dc.simulatedAtRiskValue / 1000).toFixed(0)}K
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
