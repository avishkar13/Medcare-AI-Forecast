"use client";

import { DollarSign, Package, ShieldCheck, AlertTriangle, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFormatters } from "@/hooks/use-formatters";
import { QueryError } from "@/components/ui/query-state";
import type { InventoryTotals } from "@/schemas/inventory";

/**
 * Fed from the page's own inventory response rather than fetching again.
 *
 * These cards used to call `useInventory()` with no arguments, which meant they read
 * the whole network while the table below them was narrowed to a DC or a filter -
 * two answers to the same question, on the same screen, one request apart.
 */
interface InventoryKpiCardsProps {
  totals: InventoryTotals | undefined;
  isPending: boolean;
  isError: boolean;
}

export function InventoryKpiCards({ totals, isPending, isError }: InventoryKpiCardsProps) {
  const { formatCompactCurrency, formatNumber } = useFormatters();

  if (isError) return <QueryError label="the inventory KPIs" />;
  if (isPending || !totals) return null;

  const cards = [
    {
      title: "Total Inventory Value",
      value: formatCompactCurrency(totals.inventoryValue),
      sub: `${formatNumber(totals.onHandUnits)} units on hand`,
      icon: DollarSign,
      iconColor: "text-muted-foreground",
      valueColor: "text-foreground",
    },
    {
      title: "Total SKUs",
      value: formatNumber(totals.skuCount),
      sub: `${formatNumber(totals.positionCount)} positions across ${totals.warehouseCount} DCs`,
      icon: Package,
      iconColor: "text-muted-foreground",
      valueColor: "text-foreground",
    },
    {
      title: "In-Stock Rate",
      value: `${totals.inStockRatePercent}%`,
      sub: `${formatNumber(totals.positionCount - totals.belowReorderPointCount)} of ${formatNumber(totals.positionCount)} positions`,
      icon: ShieldCheck,
      iconColor: "text-success",
      valueColor: "text-success",
    },
    {
      title: "At-Risk Positions",
      value: formatNumber(totals.belowReorderPointCount),
      sub: (
        <span className="text-destructive font-medium">
          {formatNumber(totals.belowSafetyStockCount)} below safety stock
        </span>
      ),
      icon: AlertTriangle,
      iconColor: "text-destructive",
      valueColor: "text-destructive",
    },
    {
      title: "Expiring Value",
      value: formatCompactCurrency(totals.expiringValue),
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
