"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SKUInventoryImpact } from "@/types/simulation";

interface InventoryImpactProps {
  skus: SKUInventoryImpact[];
}

export function InventoryImpact({ skus }: InventoryImpactProps) {
  const maxVal = Math.max(...skus.flatMap(s => [s.currentInventory, s.simulatedInventory, s.optimalInventory]));

  return (
    <Card className="rounded-xl border-border/60 shadow-sm h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold">Inventory Impact</CardTitle>
        <p className="text-[10px] text-muted-foreground font-medium">Current vs. simulated vs. optimal stock levels.</p>
      </CardHeader>
      <CardContent className="pt-0 flex flex-col h-[calc(100%-3rem)]">
        <div className="flex-1 overflow-y-auto pr-2 space-y-4 no-scrollbar">
          {skus.map((sku) => (
            <div key={sku.sku} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">{sku.name}</span>
                <span className="text-[10px] font-medium text-muted-foreground">{sku.sku}</span>
              </div>
              {/* Bars */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] w-14 text-muted-foreground font-medium shrink-0 uppercase tracking-wide">Current</span>
                  <div className="flex-1 h-2 bg-muted/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/60 rounded-full"
                      style={{ width: `${(sku.currentInventory / maxVal) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold tabular-nums w-12 text-right">{(sku.currentInventory / 1000).toFixed(1)}K</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] w-14 text-muted-foreground font-medium shrink-0 uppercase tracking-wide">Simulated</span>
                  <div className="flex-1 h-2.5 bg-muted/50 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full shadow-sm ${sku.simulatedInventory < sku.optimalInventory * 0.7 ? "bg-destructive" : "bg-ai"}`}
                      style={{ width: `${(sku.simulatedInventory / maxVal) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold tabular-nums w-12 text-right">{(sku.simulatedInventory / 1000).toFixed(1)}K</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] w-14 text-muted-foreground font-medium shrink-0 uppercase tracking-wide">Optimal</span>
                  <div className="flex-1 h-2 bg-muted/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-success/60 rounded-full"
                      style={{ width: `${(sku.optimalInventory / maxVal) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold tabular-nums w-12 text-right">{(sku.optimalInventory / 1000).toFixed(1)}K</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[10px] font-medium text-muted-foreground pt-2 border-t border-border/50">
          <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-primary/60" /> Current</div>
          <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-ai" /> Simulated</div>
          <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-success/60" /> Optimal</div>
        </div>
      </CardContent>
    </Card>
  );
}
