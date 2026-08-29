"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";
import { useInventory, useInventoryHealth } from "@/hooks/use-inventory";
import { Info, BarChart2 } from "lucide-react";
import { useFormatters } from "@/hooks/use-formatters";
import { useUiStore } from "@/store/ui.store";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { QueryError } from "@/components/ui/query-state";

export function InventoryHealthChart() {
  const { formatCompactCurrency, formatCurrency, formatNumber } = useFormatters();
  const dc = useUiStore((state) => state.dc);

  /**
   * The five closest to running out, ranked by the server.
   *
   * This used to fetch the default page and sort it in the browser, which ranked the
   * first 50 positions by SKU and called the worst of those "top SKUs" - the actual
   * five most urgent were usually not among them. `daysOfSupply` is the server's
   * urgency order, and it pushes positions with no demand to the end rather than
   * treating a zero-demand shelf as the most critical thing on the network.
   */
  const { data, isPending, isError } = useInventory({
    sort: "daysOfSupply",
    pageSize: 5,
    ...(dc ? { warehouse: dc } : {}),
  });
  const { data: health } = useInventoryHealth(dc);
  const positions = data?.items ?? [];

  const items = positions.map((row) => ({
    name: row.sku,
    "Current Stock": row.onHand,
    "Available": row.available,
    "Safety Stock": row.safetyStock,
  }));

  // the health route already groups value by category, sorted
  const catChartData = (health?.byCategory ?? [])
    .slice(0, 4)
    .map((row) => ({ name: row.category, value: row.inventoryValue }));

  if (isError) return <QueryError label="inventory health" />;

  if (isPending || positions.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-sm text-muted-foreground">
          {isPending ? "Loading inventory…" : "No inventory to chart."}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          Inventory Health
          <Tooltip>
            <TooltipTrigger render={<Info className="h-4 w-4 text-muted-foreground cursor-help" />} />
            <TooltipContent>
              <p className="max-w-xs">WHETHER we have enough stock. Compares stock on hand and the units actually available against AI-optimized safety minimums.</p>
            </TooltipContent>
          </Tooltip>
        </CardTitle>
        <CardDescription>Units on hand, available and required across the five positions closest to running out</CardDescription>
      </CardHeader>
      <CardContent className="p-6 pt-0 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col h-full gap-8">
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={items} margin={{ top: 20, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} tickMargin={10} />
                {/* Units, not money. This axis used to render unit counts as currency. */}
                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => formatNumber(val as number)} />
                <RechartsTooltip
                  cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', backgroundColor: 'var(--card)', color: 'var(--card-foreground)' }}
                  labelStyle={{ color: 'var(--card-foreground)' }}
                  formatter={(val: unknown) => `${formatNumber(val as number)} units`}
                />
                <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />

                <Bar dataKey="Current Stock" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar dataKey="Available" fill="var(--success)" radius={[4, 4, 0, 0]} maxBarSize={32} opacity={0.85} />
                <Bar dataKey="Safety Stock" fill="var(--destructive)" radius={[4, 4, 0, 0]} maxBarSize={32} opacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex-1 flex flex-col min-h-[200px]">
            <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-4">
              <BarChart2 className="h-4 w-4" />
              Value by Category
            </h4>
            <div className="flex-1 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={catChartData} margin={{ top: 0, right: 10, left: 30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => formatCompactCurrency(val)} />
                  <YAxis dataKey="name" type="category" fontSize={12} tickLine={false} axisLine={false} tickMargin={10} />
                  <RechartsTooltip
                    cursor={{ fill: 'var(--muted)', opacity: 0.2 }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', backgroundColor: 'var(--card)', color: 'var(--card-foreground)' }}
                    labelStyle={{ color: 'var(--card-foreground)' }}
                    formatter={(val: unknown) => formatCurrency(val as number)}
                  />
                  <Bar dataKey="value" fill="var(--ai)" radius={[0, 4, 4, 0]} barSize={20} name="Inventory Value" opacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
