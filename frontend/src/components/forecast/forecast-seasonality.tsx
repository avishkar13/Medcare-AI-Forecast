"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";
import { useForecastSeasonality, useForecastTrend } from "@/hooks/use-forecast";
import { useForecastScope } from "@/store/filters.store";
import { QueryError } from "@/components/ui/query-state";

export function ForecastSeasonality() {
  const scope = useForecastScope();
  const { data: raw, isPending, isError } = useForecastSeasonality(scope);
  const { data: trend } = useForecastTrend(scope);

  const data = {
    // the index is centred on 1, so 100 reads as an average day
    weeklyPattern: (raw?.weeklyPattern ?? []).map((d) => ({
      day: String(d.label),
      value: d.indexPercent,
    })),
    monthlyTrend: (raw?.monthlyPattern ?? []).map((m) => ({
      month: String(m.label),
      value: m.indexPercent,
    })),
    seasonalUplift: raw?.seasonalUpliftPercent ?? null,
    volatility: trend?.demandVolatility ?? "—",
  };

  if (isPending) return null;

  if (isError) return <QueryError label="seasonality" />;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Demand Seasonality</CardTitle>
        <CardDescription>Recurring patterns & volatility</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          <div>
            <h4 className="text-sm font-medium mb-4">Weekly Demand Pattern</h4>
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.weeklyPattern} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="day" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)' }} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} width={30} tick={{ fill: 'var(--muted-foreground)' }} />
                  <Tooltip 
                    cursor={{ fill: 'var(--muted)' }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)' }}
                    itemStyle={{ color: 'var(--foreground)', fontSize: '13px' }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {data.weeklyPattern.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.value > 115 ? 'var(--ai)' : 'var(--muted-foreground)'} opacity={entry.value > 115 ? 1 : 0.4} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-4">Monthly Trend</h4>
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthlyTrend} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)' }} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} width={30} tick={{ fill: 'var(--muted-foreground)' }} />
                  <Tooltip 
                    cursor={{ fill: 'var(--muted)' }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)' }}
                    itemStyle={{ color: 'var(--foreground)', fontSize: '13px' }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="var(--foreground)" opacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground">Seasonal Uplift</p>
            <p className="text-lg font-bold text-foreground">
              {data.seasonalUplift === null ? "—" : `+${data.seasonalUplift}%`}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Volatility</p>
            <p className="text-sm font-semibold text-foreground mt-1">{data.volatility}</p>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
