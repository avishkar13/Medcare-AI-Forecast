"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, TrendingDown } from "lucide-react";
import { useExpiryDemandCoverage } from "@/hooks/use-expiry";
import { useFormatters } from "@/hooks/use-formatters";
import { QueryError } from "@/components/ui/query-state";

export function DemandExpiryAnalysis() {
  const { formatCompactCurrency, formatNumber } = useFormatters();
  const { data, isPending, isError } = useExpiryDemandCoverage();

  // Before the null guard: on failure `data` is undefined, so a guard that
  // returns null on falsy data swallows the error and the panel just vanishes.
  if (isError) return <QueryError label="demand coverage" />;
  if (isPending || !data) return null;


  return (
    <Card className="border-border/60 shadow-sm bg-background h-full flex flex-col">
      <CardHeader className="pb-4 border-b border-border/50">
        <CardTitle className="text-sm font-bold flex flex-col gap-1">
          <span className="text-base flex items-center gap-2">
            <LineChart className="h-4 w-4 text-muted-foreground" />
            Can Demand Consume the Inventory Before Expiry?
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-6 flex-1 flex flex-col">
        <div className="flex-1 flex flex-col lg:flex-row items-center gap-8 mt-2 mb-2">

          <div className="flex-1 w-full space-y-4">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-success flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-success"/> Forecast Demand ({formatNumber(data.consumableUnits)})</span>
              <span className="text-destructive flex items-center gap-1.5">Unused Waste ({formatNumber(data.unusedUnits)}) <div className="w-2 h-2 rounded-full bg-destructive"/></span>
            </div>

            <div className="w-full h-8 rounded-md bg-muted overflow-hidden flex border border-border/50 shadow-inner">
              <div className="h-full bg-success transition-all border-r border-background/20 relative group cursor-pointer" style={{ width: `${data.utilizationPercent}%` }}>
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors"/>
              </div>
              <div className="h-full bg-destructive transition-all relative group cursor-pointer" style={{ width: `${data.wastedSharePercent}%` }}>
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors"/>
              </div>
            </div>

            <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-wider text-muted-foreground mt-2">
              <span className="bg-muted/30 px-2 py-1 rounded">Expiring Stock: {formatNumber(data.unitsExpiring)} Units</span>
              <span className="text-destructive bg-destructive/10 px-2 py-1 rounded">
                {data.soonestExpiryDays === null
                  ? "Nothing expiring"
                  : `Nearest expiry in ${data.soonestExpiryDays} days`}
              </span>
            </div>
          </div>

          <div className="w-full lg:w-72 flex flex-col gap-4">
            <div className="bg-success/5 border border-success/20 p-4 rounded-xl flex justify-between items-center transition-all hover:bg-success/10">
               <span className="text-[10px] font-bold text-success uppercase tracking-wider">Expected Utilization</span>
               <span className="text-2xl font-black text-success">{data.utilizationPercent}%</span>
            </div>
            <div className="bg-destructive/5 border border-destructive/20 p-4 rounded-xl flex justify-between items-center transition-all hover:bg-destructive/10">
               <span className="text-[10px] font-bold text-destructive uppercase tracking-wider">Value at Risk</span>
               <span className="text-2xl font-black text-destructive">{formatCompactCurrency(data.valueAtRisk)}</span>
            </div>
          </div>

        </div>

        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 flex items-center justify-between mt-auto transition-colors hover:bg-destructive/10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <TrendingDown className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-foreground">
                <span className="font-black text-destructive">{formatNumber(data.unusedUnits)} units</span> are projected to remain unused before expiry.
              </span>
              <span className="text-[10px] text-muted-foreground mt-0.5">FEFO projection at current demand rates, without intervention.</span>
            </div>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-[10px] font-bold text-destructive uppercase tracking-wider mb-0.5">Potential Waste</span>
            <span className="text-xl font-black text-destructive">{formatCompactCurrency(data.projectedWasteValue)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
