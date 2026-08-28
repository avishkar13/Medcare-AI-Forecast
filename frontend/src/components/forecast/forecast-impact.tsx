"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useForecastImpact } from "@/hooks/use-forecast";
import { useFormatters } from "@/hooks/use-formatters";
import { TrendingDown, ShieldCheck, DollarSign, PackageMinus } from "lucide-react";
import { useForecastScope } from "@/store/filters.store";
import { QueryError } from "@/components/ui/query-state";

export function ForecastImpact() {
  const scope = useForecastScope();
  const { data, isPending, isError } = useForecastImpact(scope);
  const { formatCompactCurrency } = useFormatters();

  // the card was framed as reductions, which needs a baseline. the api reports one
  // run's actual cost and risk, so the tiles show those instead of a made-up delta.
  const money = (value: number | null) =>
    value === null ? "—" : formatCompactCurrency(value);

  if (isPending) return null;

  if (isError) return <QueryError label="the forecast impact" />;

  return (
    <Card className="h-full bg-gradient-to-br from-background to-success/5 border-success/30">
      <CardHeader>
        <CardTitle>Business Impact</CardTitle>
        <CardDescription>What this plan costs, from the run that produced the forecast</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-background border border-border">
            <div className="p-2 bg-success/10 rounded-md">
              <ShieldCheck className="h-4 w-4 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Service Level</p>
              <p className="text-lg font-bold text-foreground">
                {data?.serviceLevelPercent === null || data?.serviceLevelPercent === undefined
                  ? "—"
                  : `${data.serviceLevelPercent}%`}
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3 p-3 rounded-lg bg-background border border-border">
            <div className="p-2 bg-success/10 rounded-md">
              <DollarSign className="h-4 w-4 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Expiry Cost</p>
              <p className="text-lg font-bold text-foreground">{money(data?.expiryCost ?? null)}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-background border border-border">
            <div className="p-2 bg-muted rounded-md">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Holding Cost</p>
              <p className="text-lg font-bold text-foreground">{money(data?.holdingCost ?? null)}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-background border border-border">
            <div className="p-2 bg-muted rounded-md">
              <PackageMinus className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Transfer Cost</p>
              <p className="text-lg font-bold text-foreground">{money(data?.transferCost ?? null)}</p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-success/10 border border-success/20 text-sm leading-relaxed text-success-foreground">
          <strong>Insight:</strong> {data?.totalCost === null || data?.totalCost === undefined
              ? "No completed planning run yet."
              : `Total plan cost ${money(data.totalCost)}, of which ${money(data.expiryCost)} is expiry.`}
        </div>
      </CardContent>
    </Card>
  );
}
