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
import { QueryError } from "@/components/ui/query-state";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const COLORS = [
  "var(--success)",
  "var(--warning)",
  "var(--destructive)",
  "var(--primary)",
  "#7C3AED",
];

/**
 * `warehouseId` follows the DC in the top bar. Without it this panel answered for the
 * whole network while everything around it was scoped to one site.
 */
export function InventoryHealth({ warehouseId }: { warehouseId?: string }) {
  const { data, isPending, isError } = useInventoryHealth(warehouseId);
  const { formatCompactCurrency } = useFormatters();
  const health = data?.breakdown;

  if (isError) return <QueryError label="inventory health" />;

  if (isPending || !health || !data) return null;

  const categoryData = data.byCategory.map((row) => ({
    name: row.category,
    value: row.inventoryValue,
    skus: row.skuCount,
    positions: row.positionCount,
  }));

  /**
   * The five states, with what each actually means.
   *
   * `classifyStock` on the backend is **ordered**, so a position lands in exactly one
   * bucket: below safety stock counts as Critical and is not counted again under Below
   * Reorder, even though it is also below its reorder point. The tooltips say so, because
   * the counts otherwise look like they should overlap and do not.
   */
  const segments = [
    {
      name: "Healthy",
      value: health.healthy,
      percent: data.breakdownPercent.healthy,
      hint: "None of the conditions below apply. Stock is within its buffer and its maximum.",
    },
    {
      name: "Below Reorder",
      value: health.belowReorderPoint,
      percent: data.breakdownPercent.belowReorderPoint,
      hint: "Inventory position — on hand plus what is already inbound, less what is reserved — has fallen under the reorder point. Replenishment is due.",
    },
    {
      name: "Critical",
      value: health.criticalStock,
      percent: data.breakdownPercent.criticalStock,
      hint: "Available stock — on hand less what is reserved — is below safety stock, so it cannot cover demand over the lead time. Counted here rather than under Below Reorder.",
    },
    {
      name: "Excess",
      value: health.excessStock,
      percent: data.breakdownPercent.excessStock,
      hint: "On hand is above the configured maximum for this position. Capital tied up, and expiry exposure if it does not move.",
    },
    {
      name: "Expiring",
      value: health.expiringSoon,
      percent: data.breakdownPercent.expiringSoon,
      hint: "Holds at least one batch expiring within 15 days, and is not already short or in excess.",
    },
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
                    formatter={(value: any) => [`${value} positions`, undefined]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex flex-col gap-2 flex-1">
              {segments.map((seg, i) => (
                <Tooltip key={seg.name}>
                  <TooltipTrigger
                    render={
                      <div className="flex cursor-help items-center justify-between text-xs" />
                    }
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${dotColors[i]}`} />
                      <span className="font-medium text-foreground underline decoration-dotted decoration-muted-foreground/40 underline-offset-4">
                        {seg.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold tabular-nums text-foreground">{seg.value}</span>
                      <span className="text-muted-foreground tabular-nums w-10 text-right">
                        {seg.percent}%
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[280px] text-xs leading-relaxed">
                    {seg.hint}
                  </TooltipContent>
                </Tooltip>
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
                  formatter={(value: any, _name: any, item: any) => [
                    // Both counts, because they differ network-wide and reading one as the
                    // other is what made the category figures look frozen.
                    `${formatCompactCurrency(Number(value))} · ${item?.payload?.skus ?? 0} SKUs across ${item?.payload?.positions ?? 0} positions`,
                    "Value",
                  ]}
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
