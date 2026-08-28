"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useLatestComparison } from "@/hooks/use-planning";
import { useFormatters } from "@/hooks/use-formatters";
import { TrendingDown, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";

export function OptimizationSummary() {
  const { data, isPending, isError, hasTwoRuns } = useLatestComparison();
  // Was a local formatter hardcoded to USD; the shared one follows the configured
  // currency and its grouping.
  const { formatCompactCurrency: formatCurrency } = useFormatters();

  const cost = data?.cost;

  const chartData = cost
    ? [
        { name: "Holding", Current: cost.holding.baseline, Optimized: cost.holding.scenario },
        { name: "Stockout", Current: cost.stockout.baseline, Optimized: cost.stockout.scenario },
        { name: "Expiry", Current: cost.expiry.baseline, Optimized: cost.expiry.scenario },
        { name: "Transfer", Current: cost.transfer.baseline, Optimized: cost.transfer.scenario },
      ]
    : [];

  // baseline is the do-nothing run, scenario is the one being evaluated. savings is
  // pre-oriented by the api so positive always means the scenario did better.
  const metrics = cost
    ? {
        current: { totalCost: cost.total.baseline },
        optimized: { totalCost: cost.total.scenario },
        savings: data!.headline.costSaved,
        savingsPercentage:
          cost.total.percentChange === null ? null : -cost.total.percentChange,
      }
    : null;

  if (isPending || isError || !hasTwoRuns || !metrics) {
    return (
      <Card className="flex flex-col">
        <CardHeader className="pb-4 border-b border-border/50">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingDown className="h-4 w-4 text-primary" />
            Optimization Summary
          </CardTitle>
          <CardDescription>Cost of the plan against a baseline run</CardDescription>
        </CardHeader>
        <CardContent className="py-8 text-sm text-muted-foreground">
          {isPending
            ? "Loading…"
            : isError
              ? "Could not load the comparison."
              : "Needs two completed planning runs to compare. Run the planner twice — once as a baseline, once under a scenario."}
        </CardContent>
      </Card>
    );
  }

  const warnings = data?.warnings ?? [];

  return (
    <Card className="flex flex-col h-[400px] border-primary/20 bg-gradient-to-br from-card via-card to-primary/5">
      <CardHeader className="pb-2 border-b border-border/40 bg-muted/20">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingDown className="h-4 w-4 text-success" />
          Optimization Impact
          <Tooltip>
            <TooltipTrigger render={<Info className="h-4 w-4 text-muted-foreground cursor-help" />} />
            <TooltipContent>
              <p className="max-w-xs">Cost-benefit analysis comparing the current network strategy against the AI-optimized network strategy over the next 30 days.</p>
            </TooltipContent>
          </Tooltip>
        </CardTitle>
        <CardDescription>Current Strategy vs AI Optimized Strategy</CardDescription>
      </CardHeader>
      <CardContent className="pt-6 flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1 p-4 rounded-lg bg-muted/50 border border-border">
            <span className="text-sm font-medium text-muted-foreground">Current Cost</span>
            <span className="text-2xl font-bold tabular-nums text-foreground">{formatCurrency(metrics.current.totalCost)}</span>
          </div>
          <div className="flex flex-col gap-1 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <span className="text-sm font-medium text-primary">Optimized Cost</span>
            <span className="text-2xl font-bold tabular-nums text-primary">{formatCurrency(metrics.optimized.totalCost)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-success/10 border border-success/20 rounded-lg">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-success">Projected Savings</span>
            <span className="text-2xl font-bold tabular-nums text-success">{formatCurrency(metrics.savings)}</span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-sm font-medium text-success">Cost Reduction</span>
            <span className="text-2xl font-bold tabular-nums text-success">{metrics.savingsPercentage === null ? "—" : `${metrics.savingsPercentage.toFixed(1)}%`}</span>
          </div>
        </div>
        {warnings.length > 0 ? (
          <p className="text-xs text-muted-foreground mt-3">{warnings.join(" ")}</p>
        ) : null}

        <div className="w-full h-[140px] mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
              <XAxis type="number" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val/1000}k`} />
              <YAxis dataKey="name" type="category" fontSize={11} tickLine={false} axisLine={false} width={60} />
              <RechartsTooltip 
                cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: '12px' }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => [formatCurrency(Number(value)), undefined]}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Bar dataKey="Current" fill="var(--muted-foreground)" radius={[0, 4, 4, 0]} barSize={12} opacity={0.5} />
              <Bar dataKey="Optimized" fill="var(--primary)" radius={[0, 4, 4, 0]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
