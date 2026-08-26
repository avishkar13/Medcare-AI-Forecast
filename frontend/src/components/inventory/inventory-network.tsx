"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useDashboardNetwork } from "@/hooks/use-dashboard";
import { formatCompactCurrency } from "@/lib/utils";

export function InventoryNetwork() {
  const { data, isPending } = useDashboardNetwork();

  const dcs = (data ?? []).map((dc) => ({
    id: dc.id,
    name: dc.name,
    utilization: dc.utilization,
    inventoryValue: dc.inventoryValue,
    atRiskInventory: dc.expiringValue,
    stockoutRisk: dc.stockoutRisk,
    skuCount: dc.skuCount,
    capacity: dc.capacity,
  }));

  if (isPending) return null;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-4 border-b border-border/50">
        <CardTitle className="text-base font-semibold">Network Inventory</CardTitle>
        <CardDescription>Distribution center stock and capacity overview</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex flex-col divide-y divide-border/50">
          {dcs.map((dc) => (
            <div key={dc.id} className="px-6 py-4 flex flex-col gap-3 hover:bg-muted/10 transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-foreground">{dc.name}</span>
                <span className="text-xs font-medium bg-muted px-2 py-1 rounded-sm tabular-nums">
                  {formatCompactCurrency(dc.inventoryValue)}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Capacity</span>
                  <span className={`font-medium ${dc.utilization > 90 ? "text-warning" : "text-foreground"}`}>
                    {dc.utilization}%
                  </span>
                </div>
                <Progress value={dc.utilization} className="h-1.5" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">At-Risk</span>
                  <span className="text-sm font-semibold tabular-nums text-warning">
                    {formatCompactCurrency(dc.atRiskInventory)}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Stockout Risk</span>
                  <span className="text-sm font-semibold tabular-nums text-destructive">{dc.stockoutRisk}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
