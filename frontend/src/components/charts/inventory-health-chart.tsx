"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";
import { useInventory } from "@/hooks/use-inventory";
import { Info, BarChart2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function InventoryHealthChart() {
  const { data, isPending } = useInventory();
  const positions = data?.items ?? [];

  // the five positions closest to running out say more than the first five
  const items = [...positions]
    .sort((a, b) => a.daysOfSupply - b.daysOfSupply)
    .slice(0, 5)
    .map((row) => ({
      name: row.productName.split(" ")[0],
      "Current Stock": row.onHand,
      "Safety Stock": row.safetyStock,
      "Reorder Point": row.reorderPoint,
      status: row.status,
    }));

  const categoryData = positions.reduce((acc, row) => {
    acc[row.category] = (acc[row.category] || 0) + row.inventoryValue;
    return acc;
  }, {} as Record<string, number>);

  const catChartData = Object.entries(categoryData)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 4);

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
              <p className="max-w-xs">WHETHER we have enough stock. Compares current stock levels against AI-optimized safety minimums and reorder thresholds.</p>
            </TooltipContent>
          </Tooltip>
        </CardTitle>
        <CardDescription>Current vs Optimal levels across top SKUs</CardDescription>
      </CardHeader>
      <CardContent className="p-6 pt-0 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col h-full gap-8">
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={items} margin={{ top: 20, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} tickMargin={10} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val/1000}k`} />
                <RechartsTooltip 
                  cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                />
                <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
                
                <Bar dataKey="Current Stock" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Safety Stock" fill="var(--destructive)" radius={[4, 4, 0, 0]} maxBarSize={40} opacity={0.7} />
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
                  <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val/1000}k`} />
                  <YAxis dataKey="name" type="category" fontSize={12} tickLine={false} axisLine={false} tickMargin={10} />
                  <RechartsTooltip 
                    cursor={{ fill: 'var(--muted)', opacity: 0.2 }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(val: any) => `$${(val as number).toLocaleString()}`}
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
