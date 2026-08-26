"use client";

import { 
  PackageSearch, 
  AlertTriangle, 
  Clock, 
  TrendingUp, 
  Sparkles,
  DollarSign 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardSummary } from "@/hooks/use-dashboard";

export function KpiCards() {
  const { data, isPending, isError } = useDashboardSummary();
  const kpis = data?.kpis;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Inventory Value</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{formatCurrency(kpis.totalInventoryValue)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            <span className="text-success font-medium">+2.1%</span> from last month
          </p>
        </CardContent>
      </Card>

      {/* SKUs Monitored */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">SKUs Monitored</CardTitle>
          <PackageSearch className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{formatNumber(kpis.skusMonitored)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Active tracking across 4 locations
          </p>
        </CardContent>
      </Card>

      {/* Stockout Risk */}
      <Card>
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

      {/* Expiry Risk */}
      <Card>
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

      {/* Forecast Accuracy */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">Forecast Accuracy</CardTitle>
          <TrendingUp className="h-4 w-4 text-ai" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{percent(kpis.forecastAccuracy)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            <span className="text-success font-medium">+1.2%</span> improvement (30d)
          </p>
        </CardContent>
      </Card>

      {/* Pending Recommendations */}
      <Card>
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
    </div>
  );
}
