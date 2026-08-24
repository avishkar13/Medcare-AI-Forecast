"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ComposedChart, Line, ReferenceLine } from "recharts";
import { mockForecastData } from "@/lib/mockData";

export function ForecastMainChart() {
  const sku = "SKU-LIS-10"; // Defaulting to one of the mock SKUs
  const data = mockForecastData[sku] || [];
  
  const chartData = data.map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    actual: d.actualDemand,
    predicted: d.predictedDemand,
    bounds: d.lowerBound && d.upperBound ? [d.lowerBound, d.upperBound] : null,
  }));

  const todayStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });

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
                name="95% Confidence Interval" 
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
            <span className="text-sm text-muted-foreground">95% Confidence Range</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
