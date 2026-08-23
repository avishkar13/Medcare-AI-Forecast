import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { mockNetworkHealth } from "@/lib/mockData";
import { Activity } from "lucide-react";

export function NetworkHealth() {
  const health = mockNetworkHealth;
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Network Health
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-success tabular-nums">{health.overallScore}</span>
            <span className="text-xs text-muted-foreground mt-1">/ 100</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">In-Stock Percentage</span>
              <span className="text-sm text-muted-foreground tabular-nums">{health.inStockPercentage}%</span>
            </div>
            <Progress value={health.inStockPercentage} />
          </div>
          
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">At-Risk SKUs</span>
              <span className="text-lg font-semibold tabular-nums">{health.atRiskSkuCount}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Excess Inventory</span>
              <span className="text-lg font-semibold tabular-nums">{formatCurrency(health.excessInventoryValue)}</span>
            </div>
            <div className="flex flex-col gap-1 col-span-2">
              <span className="text-xs text-muted-foreground">Shortage Value</span>
              <span className="text-lg font-semibold text-destructive tabular-nums">{formatCurrency(health.shortageValue)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
