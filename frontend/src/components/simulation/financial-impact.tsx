"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FinancialImpact as FinancialImpactType } from "@/types/simulation";
import { ArrowRight, TrendingUp } from "lucide-react";

interface FinancialImpactProps {
  data: FinancialImpactType;
}

const COST_CATEGORIES = [
  { key: "inventoryHolding" as const, label: "Inventory Holding", color: "bg-primary" },
  { key: "stockoutPenalties" as const, label: "Stockout Penalties", color: "bg-destructive" },
  { key: "expeditedFreight" as const, label: "Expedited Freight", color: "bg-warning" },
  { key: "expiryWaste" as const, label: "Expiry Waste", color: "bg-ai" },
];

export function FinancialImpactComponent({ data }: FinancialImpactProps) {
  const maxCategoryVal = Math.max(
    ...COST_CATEGORIES.map(c => Math.max(data.currentBreakdown[c.key], data.simulatedBreakdown[c.key]))
  );

  return (
    <Card className="rounded-xl border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-bold">Financial Impact</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Top summary */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
          <div className="flex-1 p-4 rounded-xl bg-background border border-border/50 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Current Cost</p>
            <p className="text-xl font-black text-foreground tabular-nums">${(data.currentCost / 1000).toFixed(1)}K</p>
          </div>
          <div className="flex items-center justify-center">
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 p-4 rounded-xl bg-background border border-border/50 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Simulated Cost</p>
            <p className="text-xl font-black text-foreground tabular-nums">${(data.simulatedCost / 1000).toFixed(1)}K</p>
          </div>
          <div className={`flex-1 p-4 rounded-xl text-center border ${data.additionalCost > 0 ? "bg-destructive/5 border-destructive/20" : "bg-success/5 border-success/20"}`}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Net Change</p>
            <p className={`text-xl font-black tabular-nums flex items-center justify-center gap-1 ${data.additionalCost > 0 ? "text-destructive" : "text-success"}`}>
              <TrendingUp className={`h-4 w-4 ${data.additionalCost < 0 ? "rotate-180" : ""}`} />
              {data.additionalCost > 0 ? "+" : ""}${(data.additionalCost / 1000).toFixed(1)}K
            </p>
          </div>
        </div>

        {/* Category breakdown */}
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Cost Breakdown</p>
        <div className="space-y-3">
          {COST_CATEGORIES.map((cat) => {
            const current = data.currentBreakdown[cat.key];
            const simulated = data.simulatedBreakdown[cat.key];
            const delta = simulated - current;

            return (
              <div key={cat.key}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <div className={`h-2 w-2 rounded-full ${cat.color}`} />
                    {cat.label}
                  </span>
                  <span className={`text-[10px] font-bold tabular-nums ${delta > 0 ? "text-destructive" : delta < 0 ? "text-success" : "text-muted-foreground"}`}>
                    {delta > 0 ? "+" : ""}${(delta / 1000).toFixed(1)}K
                  </span>
                </div>
                <div className="flex gap-1 h-2.5 mt-0.5">
                  <div className="flex-1 bg-muted/40 rounded overflow-hidden relative group">
                    <div
                      className={`h-full ${cat.color} opacity-40 rounded transition-all duration-500`}
                      style={{ width: `${(current / maxCategoryVal) * 100}%` }}
                    />
                    <span className="absolute inset-y-0 left-0 flex items-center pl-1 text-[8px] font-bold text-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity">
                      ${(current / 1000).toFixed(1)}K
                    </span>
                  </div>
                  <div className="flex-1 bg-muted/40 rounded overflow-hidden relative group">
                    <div
                      className={`h-full ${cat.color} rounded transition-all duration-500`}
                      style={{ width: `${(simulated / maxCategoryVal) * 100}%` }}
                    />
                    <span className="absolute inset-y-0 left-0 flex items-center pl-1 text-[8px] font-bold text-background opacity-0 group-hover:opacity-100 transition-opacity mix-blend-exclusion">
                      ${(simulated / 1000).toFixed(1)}K
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 text-[10px] font-medium text-muted-foreground pt-3 mt-3 border-t border-border/50">
          <span className="flex items-center gap-1.5"><div className="h-2 w-6 rounded bg-primary/40" /> Current</span>
          <span className="flex items-center gap-1.5"><div className="h-2 w-6 rounded bg-primary" /> Simulated</span>
        </div>
      </CardContent>
    </Card>
  );
}
