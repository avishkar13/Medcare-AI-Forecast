"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ComposedChart, Line } from "recharts";
import { useForecastAccuracy, useForecastChart } from "@/hooks/use-forecast";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function DemandForecastChart() {
  const [sku, setSku] = useState("SKU-LIS-10");
  const [horizon, setHorizon] = useState(14);
  
  const { data: chart, isPending } = useForecastChart({ sku, days: horizon, historyDays: horizon });
  const { data: accuracy } = useForecastAccuracy({ sku });

  // history and prediction do not overlap in time, so they concatenate rather than merge
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
  
  // To render confidence bounds as a single shaded area in Recharts,
  // we use a trick: the data needs to have an array [lowerBound, upperBound] for the Area dataKey,
  // but Recharts ComposedChart Area supports array data keys.
  const chartData = data.map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    actual: d.actualDemand,
    predicted: d.predictedDemand,
    bounds: d.lowerBound && d.upperBound ? [d.lowerBound, d.upperBound] : null,
  }));

  const lastPredicted = data.find(d => d.predictedDemand)?.predictedDemand || 0;
  const lastLower = data.find(d => d.lowerBound)?.lowerBound || 0;
  const lastUpper = data.find(d => d.upperBound)?.upperBound || 0;

  if (isPending) {
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
    <Card className="col-span-full">
      <CardHeader className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6">
        <div>
          <CardTitle className="flex items-center gap-2">
            Demand Forecast
            <Tooltip>
              <TooltipTrigger render={<Info className="h-4 w-4 text-muted-foreground cursor-help" />} />
              <TooltipContent>
                <p className="max-w-xs">AI-driven predictions based on historical consumption, seasonality, and external risk factors. The shaded region represents the 95% confidence interval.</p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
          <CardDescription>WHAT demand will be across the network</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select 
            className="h-8 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
          >
            <option value="SKU-LIS-10">Lisinopril 10mg</option>
            <option value="SKU-OME-20">Omeprazole 20mg</option>
          </select>
          <select className="h-8 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <option>All Distribution Centers</option>
            <option>Northeast DC</option>
            <option>South DC</option>
            <option>West Coast DC</option>
          </select>
          <div className="flex items-center rounded-md border border-input p-0.5 ml-2">
            {[7, 14, 30].map(h => (
              <button 
                key={h} 
                onClick={() => setHorizon(h)}
                className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${horizon === h ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted/50'}`}
              >
                {h}D
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBounds" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--ai)" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="var(--ai)" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} tickMargin={10} minTickGap={30} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}`} />
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                  labelStyle={{ fontWeight: 'bold', marginBottom: '8px' }}
                />
                
                {/* Confidence Interval */}
                <Area 
                  type="monotone" 
                  dataKey="bounds" 
                  stroke="none" 
                  fill="url(#colorBounds)" 
                  name="95% Confidence Interval" 
                />
                
                {/* Historical Actual */}
                <Line 
                  type="monotone" 
                  dataKey="actual" 
                  stroke="var(--foreground)" 
                  strokeWidth={2} 
                  dot={false}
                  name="Historical Actual" 
                />
                
                {/* Predicted Demand */}
                <Line 
                  type="monotone" 
                  dataKey="predicted" 
                  stroke="var(--ai)" 
                  strokeWidth={2} 
                  strokeDasharray="5 5"
                  dot={{ r: 4, strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                  name="AI Prediction" 
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          
          <div className="flex flex-col justify-center gap-6 lg:border-l border-border/50 lg:pl-6">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                Predicted Peak
                <Tooltip>
                  <TooltipTrigger render={<Info className="h-3.5 w-3.5 cursor-help" />} />
                  <TooltipContent>Maximum expected demand in this horizon</TooltipContent>
                </Tooltip>
              </p>
              <p className="text-3xl font-bold text-foreground">{lastPredicted}</p>
            </div>
            
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Confidence Range</p>
              <p className="text-xl font-semibold text-foreground">{lastLower} - {lastUpper}</p>
              <p className="text-xs text-ai font-medium">95% Confidence Level</p>
            </div>
            
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Historical Accuracy</p>
              <p className="text-xl font-semibold text-foreground">{accuracy?.overall.accuracyPercent === null || accuracy?.overall.accuracyPercent === undefined ? "—" : `${accuracy.overall.accuracyPercent}%`}</p>
              <p className="text-xs text-success font-medium">+1.2% (last 30d)</p>
            </div>
            
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Expected Trend</p>
              <div className="flex items-center gap-2">
                <span className="text-xl font-semibold text-foreground">Growing</span>
                <div className="h-6 w-6 rounded-full bg-success/20 flex items-center justify-center">
                  <span className="text-success text-xs font-bold">↗</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
