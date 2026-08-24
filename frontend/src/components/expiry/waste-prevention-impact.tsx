"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown, Coins } from "lucide-react";

export function WastePreventionImpact() {
  const breakdown = [
    { label: "FEFO Optimization", value: 28400, color: "bg-success" },
    { label: "Internal Transfers", value: 21700, color: "bg-success/80" },
    { label: "Demand Prioritization", value: 14200, color: "bg-success/60" },
    { label: "Replenishment Adjustment", value: 11900, color: "bg-success/40" },
  ];

  const maxValue = Math.max(...breakdown.map(d => d.value));
  const formatCurrency = (val: number) => "$" + (val / 1000).toFixed(1) + "K";

  return (
    <Card className="border-border/60 shadow-sm bg-background h-full flex flex-col">
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
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Projected Waste</span>
            <span className="text-lg font-black text-foreground">$128.4K</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">AI Preventable</span>
            <span className="text-lg font-black text-success flex items-center gap-1"><TrendingDown className="h-4 w-4" /> $76.2K</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Remaining Exposure</span>
            <span className="text-lg font-black text-destructive">$52.2K</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Waste Reduction</span>
            <span className="text-lg font-black text-foreground">59.3%</span>
          </div>
        </div>

        <div className="h-px w-full bg-border/50 mb-6" />

        {/* Breakdown Bars */}
        <div className="flex-1 flex flex-col justify-center">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Preventable Waste Breakdown</h4>
          <div className="space-y-4">
            {breakdown.map((item, idx) => {
              const widthPct = (item.value / maxValue) * 100;
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
