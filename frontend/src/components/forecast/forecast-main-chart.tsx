"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ComposedChart, Line, ReferenceLine } from "recharts";
import { useForecastChart } from "@/hooks/use-forecast";
import { useForecastScope } from "@/store/filters.store";
import { QueryError } from "@/components/ui/query-state";

export function ForecastMainChart() {
  const scope = useForecastScope();
  const { data: chart, isPending, isError } = useForecastChart({ ...scope, historyDays: 30 });

  // history stops where the prediction starts, so they concatenate
  const data = [
    ...(chart?.history ?? []).map((h) => ({
      date: h.date,
      actualDemand: h.actualDemand,
      predictedDemand: undefined as number | undefined,
      lowerBound: undefined as number | undefined,
      upperBound: undefined as number | undefined,
    })),
    ...(chart?.prediction ?? []).map((p) => ({
      date: p.date,
      actualDemand: undefined as number | undefined,
      predictedDemand: p.predictedDemand,
      lowerBound: p.lowerBound,
      upperBound: p.upperBound,
    })),
  ];
  
  const chartData = data.map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    actual: d.actualDemand,
    predicted: d.predictedDemand,
    bounds: d.lowerBound && d.upperBound ? [d.lowerBound, d.upperBound] : null,
  }));

  const todayStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });

  if (isPending) {

  if (isError) return <QueryError label="the forecast" />;
    return (
      <Card>
        <CardContent className="py-10 text-sm text-muted-foreground">Loading forecast…</CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-sm text-muted-foreground">
          No forecast yet. Run the planner to generate one.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Demand Forecast</CardTitle>
        <CardDescription>Historical demand vs AI-predicted demand</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorBoundsLarge" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--ai)" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="var(--ai)" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} tickMargin={10} minTickGap={20} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}`} />
              
              <RechartsTooltip 
                contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', backgroundColor: 'var(--background)' }}
                labelStyle={{ fontWeight: 'bold', marginBottom: '8px', color: 'var(--foreground)' }}
                itemStyle={{ color: 'var(--foreground)', fontSize: '13px' }}
              />
              
              <ReferenceLine x={todayStr} stroke="var(--border)" strokeDasharray="3 3" label={{ position: 'top', value: 'Today', fill: 'var(--muted-foreground)', fontSize: 12 }} />

              {/* Confidence Interval */}
              <Area 
                type="monotone" 
                dataKey="bounds" 
                stroke="none" 
                fill="url(#colorBoundsLarge)" 
                name="p10-p90 Band" 
              />
              
              {/* Historical Actual */}
              <Line 
                type="monotone" 
                dataKey="actual" 
                stroke="var(--foreground)" 
                strokeWidth={2} 
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                name="Historical Actual" 
              />
              
              {/* Predicted Demand */}
              <Line 
                type="monotone" 
                dataKey="predicted" 
                stroke="var(--ai)" 
                strokeWidth={3} 
                strokeDasharray="5 5"
                dot={{ r: 4, strokeWidth: 2 }}
                activeDot={{ r: 6 }}
                name="AI Prediction" 
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-foreground"></div>
            <span className="text-sm text-muted-foreground">Historical Actual</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-ai border border-dashed border-ai bg-opacity-50"></div>
            <span className="text-sm text-muted-foreground">AI Prediction</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-sm bg-ai/20"></div>
            <span className="text-sm text-muted-foreground">p10-p90 Band</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
