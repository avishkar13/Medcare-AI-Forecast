"use client";

import { DollarSign, Package, ShieldCheck, AlertTriangle, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mockInventoryPageKPIs } from "@/lib/mockData";
import { formatCompactCurrency, formatNumber } from "@/lib/utils";

export function InventoryKpiCards() {
  const kpis = mockInventoryPageKPIs;

  const cards = [
    {
      title: "Total Inventory Value",
      value: formatCompactCurrency(kpis.totalInventoryValue),
      sub: <><span className="text-success font-medium">+2.1%</span> vs last month</>,
      icon: DollarSign,
      iconColor: "text-muted-foreground",
      valueColor: "text-foreground",
    },
    {
      title: "Total SKUs",
      value: formatNumber(kpis.totalSkus),
      sub: "Across 4 distribution centers",
      icon: Package,
      iconColor: "text-muted-foreground",
      valueColor: "text-foreground",
    },
    {
      title: "In-Stock Rate",
      value: `${kpis.inStockRate}%`,
      sub: <><span className="text-success font-medium">+0.3%</span> improvement</>,
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
      title: "Excess Inventory",
      value: formatCompactCurrency(kpis.excessInventoryValue),
      sub: "Potential optimization target",
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
