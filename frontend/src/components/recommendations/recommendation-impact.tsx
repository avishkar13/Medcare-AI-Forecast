"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecommendationImpact as ImpactType } from "@/types/recommendation";
import { DollarSign, ShieldCheck, TrendingDown, ArrowDown } from "lucide-react";

export function RecommendationImpact({ data }: { data: ImpactType }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3 border-b border-border/50 bg-muted/10">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-ai" />
          Recommendation Impact
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        <div className="flex justify-between items-end mb-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Current Cost</p>
            <p className="text-xl font-bold text-foreground/80">${(data.currentSupplyChainCost / 1000).toFixed(1)}K</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-ai uppercase tracking-wider mb-1">AI Optimized</p>
            <p className="text-2xl font-black text-ai">${(data.aiOptimizedCost / 1000).toFixed(1)}K</p>
          </div>
        </div>

        <div className="p-3.5 bg-gradient-to-r from-success/20 to-success/5 rounded-xl flex items-center justify-between border border-success/30 mb-6 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-success rounded-md shadow-sm">
              <TrendingDown className="h-4 w-4 text-success-foreground" />
            </div>
            <span className="text-sm font-bold text-success-foreground">Projected Savings</span>
          </div>
          <div className="text-right flex flex-col items-end">
            <p className="text-xl font-black text-success-foreground tracking-tight">${(data.projectedSavings / 1000).toFixed(1)}K</p>
            <div className="flex items-center gap-1 bg-success/20 px-1.5 py-0.5 rounded text-[10px] font-bold text-success-foreground mt-0.5">
              <ArrowDown className="h-2.5 w-2.5" />
              {data.costReductionPercentage}%
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border/50 pb-1.5">Savings Breakdown</h4>
          
          <div className="space-y-3.5">
            <div>
              <div className="flex items-center justify-between text-xs font-medium mb-1.5">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-success" />
                  Stockout Prevention
                </span>
                <span className="font-bold">{data.categories.stockout}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div className="bg-success h-full rounded-full" style={{ width: `${data.categories.stockout}%` }} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-medium mb-1.5">
                <span className="flex items-center gap-1.5">
                  <ArrowDown className="h-3.5 w-3.5 text-ai" />
                  Excess Inventory
                </span>
                <span className="font-bold">{data.categories.excessInventory}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div className="bg-ai h-full rounded-full" style={{ width: `${data.categories.excessInventory}%` }} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-medium mb-1.5">
                <span className="flex items-center gap-1.5">
                  <ArrowDown className="h-3.5 w-3.5 text-warning" />
                  Expiry Waste
                </span>
                <span className="font-bold">{data.categories.expiry}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div className="bg-warning h-full rounded-full" style={{ width: `${data.categories.expiry}%` }} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-medium mb-1.5">
                <span className="flex items-center gap-1.5">
                  <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
                  Freight / Transfers
                </span>
                <span className="font-bold">{data.categories.transfers}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div className="bg-foreground/40 h-full rounded-full" style={{ width: `${data.categories.transfers}%` }} />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
