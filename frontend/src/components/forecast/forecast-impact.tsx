"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { mockForecastImpact } from "@/lib/mockData";
import { TrendingDown, ShieldCheck, DollarSign, PackageMinus } from "lucide-react";

export function ForecastImpact() {
  const impact = mockForecastImpact;

  return (
    <Card className="h-full bg-gradient-to-br from-background to-success/5 border-success/30">
      <CardHeader>
        <CardTitle>Business Impact</CardTitle>
        <CardDescription>Estimated supply chain value from AI forecast</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-background border border-border">
            <div className="p-2 bg-success/10 rounded-md">
              <ShieldCheck className="h-4 w-4 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Stockout Exposure</p>
              <p className="text-lg font-bold text-foreground">-{impact.stockoutRiskReduction}%</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3 p-3 rounded-lg bg-background border border-border">
            <div className="p-2 bg-success/10 rounded-md">
              <DollarSign className="h-4 w-4 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Excess Inv. Reduction</p>
              <p className="text-lg font-bold text-foreground">
                ${(impact.excessInventoryReduction / 1000).toFixed(1)}K
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-background border border-border">
            <div className="p-2 bg-muted rounded-md">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Safety Stock Target</p>
              <p className="text-lg font-bold text-foreground">-{impact.safetyStockOptimization}%</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-background border border-border">
            <div className="p-2 bg-muted rounded-md">
              <PackageMinus className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Reorder Quantities</p>
              <p className="text-lg font-bold text-foreground">{impact.reorderQuantityChange}%</p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-success/10 border border-success/20 text-sm leading-relaxed text-success-foreground">
          <strong>Insight:</strong> {impact.insightText}
        </div>
      </CardContent>
    </Card>
  );
}
