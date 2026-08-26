"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import { useInventoryHealth } from "@/hooks/use-inventory";
import { useFormatters } from "@/hooks/use-formatters";

const COLORS = [
  "var(--success)",
  "var(--warning)",
  "var(--destructive)",
  "var(--primary)",
  "#7C3AED",
];

export function InventoryHealth() {
  const { data, isPending } = useInventoryHealth();
  const { formatCompactCurrency } = useFormatters();
  const health = data?.breakdown;

  if (isPending || !health || !data) return null;

  const categoryData = data.byCategory.map((row) => ({
    name: row.category,
    value: row.inventoryValue,
    skus: row.skuCount,
  }));

  const segments = [
    { name: "Healthy", value: health.healthy, percent: data.breakdownPercent.healthy },
    { name: "Below Reorder", value: health.belowReorderPoint, percent: data.breakdownPercent.belowReorderPoint },
    { name: "Critical", value: health.criticalStock, percent: data.breakdownPercent.criticalStock },
    { name: "Excess", value: health.excessStock, percent: data.breakdownPercent.excessStock },
    { name: "Expiring", value: health.expiringSoon, percent: data.breakdownPercent.expiringSoon },
  ];

  const dotColors = [
    "bg-success",
    "bg-warning",
    "bg-destructive",
    "bg-primary",
    "bg-[#7C3AED]",
  ];

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-4 border-b border-border/50">
        <CardTitle className="text-base font-semibold">Inventory Health & Category Value</CardTitle>
        <CardDescription>Network stock position and inventory distribution by therapeutic category</CardDescription>
      </CardHeader>
      <CardContent className="pt-5 flex flex-col gap-6">
        {/* Top: Donut Chart + Legend */}
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">
            Stock Condition Breakdown
          </span>
          <div className="flex items-center gap-6">
            {/* Pie Chart */}
            <div className="w-[160px] h-[160px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={segments}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={72}
                    dataKey="value"
                    strokeWidth={2}
                    stroke="var(--background)"
                  >
                    {segments.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      fontSize: "12px",
                      padding: "8px 12px",
                    }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any) => [`${value} SKUs`, undefined]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex flex-col gap-2 flex-1">
              {segments.map((seg, i) => (
                <div key={seg.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${dotColors[i]}`} />
                    <span className="font-medium text-foreground">{seg.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold tabular-nums text-foreground">{seg.value}</span>
                    <span className="text-muted-foreground tabular-nums w-10 text-right">
                      {seg.percent}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border/50" />

        {/* Bottom: Category Value Bar Chart */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Inventory Value by Category
            </span>
            <span className="text-xs font-medium text-muted-foreground">Total: {formatCompactCurrency(data.totalInventoryValue)}</span>
          </div>

          <div className="h-[170px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categoryData}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 24, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" opacity={0.6} />
                <XAxis
                  type="number"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatCompactCurrency(v)}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={90}
                />
                <RechartsTooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    fontSize: "12px",
                    padding: "8px 12px",
                  }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [formatCompactCurrency(Number(value)), "Value"]}
                />
                <Bar dataKey="value" fill="var(--primary)" radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
