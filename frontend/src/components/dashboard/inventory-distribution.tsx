"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useDashboardNetwork } from "@/hooks/use-dashboard";
import { Progress } from "@/components/ui/progress";
import { Info, MapPin } from "lucide-react";
import { useFormatters } from "@/hooks/use-formatters";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function InventoryDistribution() {
  const { formatCompactCurrency: formatCurrency } = useFormatters();
  const { data, isPending, isError } = useDashboardNetwork();

  // the component calls it atRiskInventory; the backend reports the value of stock
  // near expiry at that dc.
  const dcs = (data ?? []).map((dc) => ({
    id: dc.id,
    name: dc.name,
    utilization: dc.utilization,
    inventoryValue: dc.inventoryValue,
    atRiskInventory: dc.expiringValue,
    stockoutRisk: dc.stockoutRisk,
  }));



  if (isPending || isError) {
    return (
      <Card className="flex flex-col">
        <CardHeader className="pb-4 border-b border-border/50">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4 text-primary" />
            Inventory Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="py-6 text-sm text-muted-foreground">
          {isPending ? "Loading…" : "Could not load distribution."}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-4 border-b border-border/50">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="h-4 w-4 text-primary" />
          Inventory Distribution
          <Tooltip>
            <TooltipTrigger render={<Info className="h-4 w-4 text-muted-foreground cursor-help" />} />
            <TooltipContent>
              <p className="max-w-xs">WHERE inventory sits. Analyzes capacity utilization and risk exposure across the regional distribution network.</p>
            </TooltipContent>
          </Tooltip>
        </CardTitle>
        <CardDescription>Network capacity and risk by location</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex flex-col divide-y divide-border/50">
          {dcs.map((dc) => (
            <div key={dc.id} className="px-4 py-3 flex flex-col gap-4 hover:bg-muted/10 transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">{dc.name}</span>
                <span className="text-xs font-medium bg-muted px-2 py-1 rounded-sm">{formatCurrency(dc.inventoryValue)} Value</span>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Capacity Utilization</span>
                  <span className={`font-medium ${(dc.utilization ?? 0) > 90 ? 'text-warning' : 'text-foreground'}`}>
                    {dc.utilization === null ? "—" : `${dc.utilization}%`}
                  </span>
                </div>
                <Progress 
                  value={dc.utilization ?? 0} 
                  className="h-1.5"
                  // Use inline style hack to change color if we want, or just rely on default
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">At-Risk Value</span>
                  <span className="text-sm font-semibold tabular-nums text-warning">{formatCurrency(dc.atRiskInventory)}</span>
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
