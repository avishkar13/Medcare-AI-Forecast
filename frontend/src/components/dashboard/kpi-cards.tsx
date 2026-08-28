"use client";

import { 
  PackageSearch, 
  AlertTriangle, 
  Clock, 
  TrendingUp, 
  Sparkles,
  DollarSign 
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useScopedHref } from "@/hooks/use-scope";
import { useDashboardSummary } from "@/hooks/use-dashboard";
import { useWarehouses } from "@/hooks/use-masterdata";
import { useFormatters } from "@/hooks/use-formatters";

export function KpiCards() {
  // Every one of these six cards carried a number about somewhere else in the app
  // and no way to get there. Scoped, so the DC in the top bar travels with the click.
  const scopedHref = useScopedHref();
  const { data, isPending, isError } = useDashboardSummary();
  const { data: warehouses } = useWarehouses();
  const { formatCurrency, formatNumber } = useFormatters();
  const kpis = data?.kpis;

  // the backend returns null where a figure has nothing to measure against
  const percent = (value: number | null | undefined) =>
    value === null || value === undefined ? "—" : `${value}%`;

  if (isPending) {
    return (
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 w-24 rounded bg-muted animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-7 w-20 rounded bg-muted animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (isError || !kpis) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Could not load dashboard figures.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
      {/* Total Inventory Value */}
      <Link href={scopedHref("/inventory")} className="rounded-xl">
      <Card className="h-full cursor-pointer transition-colors hover:border-primary/40">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Inventory Value</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{formatCurrency(kpis.totalInventoryValue)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Across {formatNumber(kpis.skusMonitored)} SKUs
          </p>
        </CardContent>
      </Card>
      </Link>

      {/* SKUs Monitored */}
      <Link href={scopedHref("/inventory")} className="rounded-xl">
      <Card className="h-full cursor-pointer transition-colors hover:border-primary/40">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">SKUs Monitored</CardTitle>
          <PackageSearch className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{formatNumber(kpis.skusMonitored)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Active tracking across {warehouses?.length ?? 0} locations
          </p>
        </CardContent>
      </Card>
      </Link>

      {/* Stockout Risk */}
      <Link href={scopedHref("/alerts")} className="rounded-xl">
      <Card className="h-full cursor-pointer transition-colors hover:border-primary/40">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">Stockout Risk</CardTitle>
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">{kpis.stockoutRiskItems}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Items requiring immediate attention
          </p>
        </CardContent>
      </Card>
      </Link>

      {/* Expiry Risk */}
      <Link href={scopedHref("/expiry")} className="rounded-xl">
      <Card className="h-full cursor-pointer transition-colors hover:border-primary/40">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">Expiry Risk (90 Days)</CardTitle>
          <Clock className="h-4 w-4 text-warning" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-warning">{kpis.expiryRiskItems}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Batches expiring soon
          </p>
        </CardContent>
      </Card>
      </Link>

      {/* Forecast Accuracy */}
      <Link href={scopedHref("/forecast")} className="rounded-xl">
      <Card className="h-full cursor-pointer transition-colors hover:border-primary/40">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">Forecast Accuracy</CardTitle>
          <TrendingUp className="h-4 w-4 text-ai" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{percent(kpis.forecastAccuracy)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {kpis.forecastAccuracy === null ? "No forecast day realised yet" : "From the latest scored run"}
          </p>
        </CardContent>
      </Card>
      </Link>

      {/* Pending Recommendations */}
      <Link href={scopedHref("/recommendations")} className="rounded-xl">
      <Card className="h-full cursor-pointer transition-colors hover:border-primary/40">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">Recommendations</CardTitle>
          <Sparkles className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{kpis.pendingRecommendations}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Pending AI actions to review
          </p>
        </CardContent>
      </Card>
      </Link>
    </div>
  );
}
