"use client";

import { DollarSign, Package, ShieldCheck, AlertTriangle, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useInventory } from "@/hooks/use-inventory";
import { useFormatters } from "@/hooks/use-formatters";
import { QueryError } from "@/components/ui/query-state";

export function InventoryKpiCards() {
  const { formatCompactCurrency, formatNumber } = useFormatters();
  const { data, isPending, isError } = useInventory();
  const totals = data?.totals;

  const kpis = {
    totalInventoryValue: totals?.inventoryValue ?? 0,
    totalSkus: totals?.skuCount ?? 0,
    inStockRate: totals?.inStockRatePercent ?? 0,
    atRiskSkus: totals?.belowReorderPointCount ?? 0,
    atRiskCritical: totals?.belowSafetyStockCount ?? 0,
    expiringValue: totals?.expiringValue ?? 0,
  };

  if (isPending || !totals) return null;

  if (isError) return <QueryError label="the inventory KPIs" />;

  const cards = [
    {
      title: "Total Inventory Value",
      value: formatCompactCurrency(kpis.totalInventoryValue),
      sub: `${formatNumber(totals.onHandUnits)} units on hand`,
      icon: DollarSign,
      iconColor: "text-muted-foreground",
      valueColor: "text-foreground",
    },
    {
      title: "Total SKUs",
      value: formatNumber(kpis.totalSkus),
      sub: `Across ${totals.warehouseCount} distribution centers`,
      icon: Package,
      iconColor: "text-muted-foreground",
      valueColor: "text-foreground",
    },
    {
      title: "In-Stock Rate",
      value: `${kpis.inStockRate}%`,
      sub: `${formatNumber(totals.positionCount - totals.belowReorderPointCount)} of ${formatNumber(totals.positionCount)} positions`,
      icon: ShieldCheck,
      iconColor: "text-success",
      valueColor: "text-success",
    },
    {
      title: "At-Risk SKUs",
      value: String(kpis.atRiskSkus),
      sub: <span className="text-destructive font-medium">{kpis.atRiskCritical} critical</span>,
      icon: AlertTriangle,
      iconColor: "text-destructive",
      valueColor: "text-destructive",
    },
    {
      title: "Expiring Value",
      value: formatCompactCurrency(kpis.expiringValue),
      sub: `${formatNumber(totals.aboveMaximumCount)} positions above maximum`,
      icon: TrendingDown,
      iconColor: "text-warning",
      valueColor: "text-warning",
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card key={c.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
              <Icon className={`h-4 w-4 ${c.iconColor}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${c.valueColor}`}>{c.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
