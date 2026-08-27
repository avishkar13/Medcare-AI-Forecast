"use client";

import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Clock, PackageX, TrendingDown, DollarSign } from "lucide-react";
import { useExpiryOverview } from "@/hooks/use-expiry";
import { useFormatters } from "@/hooks/use-formatters";
import { QueryError } from "@/components/ui/query-state";

export function ExpiryOverview() {
  const { data: overview, isPending, isError } = useExpiryOverview();
  const { formatCompactCurrency, formatNumber } = useFormatters();

  if (isPending || !overview) return null;

  if (isError) return <QueryError label="the expiry overview" />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
      <Card className="border-border/60 shadow-sm bg-background transition-all hover:shadow-md hover:border-primary/20 group">
        <CardContent className="p-4 flex flex-col justify-between h-full">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">At-Risk Inventory</span>
            <div className="p-1.5 rounded bg-primary/10">
              <DollarSign className="h-3.5 w-3.5 text-primary" />
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-black text-foreground tracking-tight">{formatCompactCurrency(overview.totalAtRiskValue)}</h3>
            <p className="text-xs font-semibold text-muted-foreground mt-1">Across {formatNumber(overview.batchesTracked)} batches</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/20 shadow-sm bg-destructive/5 relative overflow-hidden transition-all hover:shadow-md hover:border-destructive/40">
        <div className="absolute left-0 top-0 w-1 h-full bg-destructive" />
        <CardContent className="p-4 flex flex-col justify-between h-full">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-destructive">Critical Batches</span>
            <div className="p-1.5 rounded bg-destructive/10">
              <AlertCircle className="h-3.5 w-3.5 text-destructive" />
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-black text-destructive tracking-tight">{formatNumber(overview.criticalBatches)}</h3>
            <p className="text-xs font-bold text-destructive/80 mt-1">{formatCompactCurrency(overview.criticalAtRiskValue)} at risk</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-warning/30 shadow-sm bg-warning/5 relative overflow-hidden transition-all hover:shadow-md hover:border-warning/50">
        <div className="absolute left-0 top-0 w-1 h-full bg-warning" />
        <CardContent className="p-4 flex flex-col justify-between h-full">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-warning-foreground">Avg Days to Expiry</span>
            <div className="p-1.5 rounded bg-warning/20">
              <Clock className="h-3.5 w-3.5 text-warning-foreground" />
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-black text-warning-foreground tracking-tight">
              {overview.averageDaysToExpiry === null ? "—" : Math.round(overview.averageDaysToExpiry)}
            </h3>
            <p className="text-xs font-bold text-warning-foreground/80 mt-1">Across tracked batches</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-sm bg-background transition-all hover:shadow-md">
        <CardContent className="p-4 flex flex-col justify-between h-full">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Units at Risk</span>
            <div className="p-1.5 rounded bg-muted/20">
              <PackageX className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-black text-foreground tracking-tight">{formatNumber(overview.unitsAtRisk)}</h3>
            <p className="text-xs font-semibold text-muted-foreground mt-1">Potentially exposed</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-success/20 shadow-sm bg-success/5 relative overflow-hidden transition-all hover:shadow-md hover:border-success/40">
        <div className="absolute left-0 top-0 w-1 h-full bg-success" />
        <CardContent className="p-4 flex flex-col justify-between h-full">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-success">Prevented Waste</span>
            <div className="p-1.5 rounded bg-success/10">
              <TrendingDown className="h-3.5 w-3.5 text-success" />
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-black text-success tracking-tight">
              {overview.preventedWasteValue === null ? "—" : formatCompactCurrency(overview.preventedWasteValue)}
            </h3>
            <p className="text-xs font-bold text-success/80 mt-1">
              {overview.preventedWasteUnits === null
                ? "Nothing recorded yet"
                : `${formatNumber(overview.preventedWasteUnits)} units saved`}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
