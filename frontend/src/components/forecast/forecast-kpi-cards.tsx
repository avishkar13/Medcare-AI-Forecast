"use client";

import { Card, CardContent } from "@/components/ui/card";
import { mockForecastPageKPIs } from "@/lib/mockData";
import { LineChart, Target, ShieldCheck, ArrowUpRight, Activity } from "lucide-react";

export function ForecastKpiCards() {
  const kpis = mockForecastPageKPIs;
  
  const cards = [
    {
      title: "Forecasted Demand",
      value: `${kpis.forecastedDemand.toLocaleString()} units`,
      sub: `Next ${kpis.forecastHorizonDays} days`,
      icon: <LineChart className="h-5 w-5 text-ai" />,
      highlight: true
    },
    {
      title: "Forecast Accuracy",
      value: `${kpis.forecastAccuracy}%`,
      sub: `+${kpis.accuracyChange}% vs previous period`,
      icon: <Target className="h-5 w-5 text-success" />,
      highlight: false
    },
    {
      title: "Confidence Level",
      value: `${kpis.confidenceLevel}%`,
      sub: "High confidence",
      icon: <ShieldCheck className="h-5 w-5 text-ai" />,
      highlight: false
    },
    {
      title: "Expected Peak",
      value: `${kpis.expectedPeakDemand} units/day`,
      sub: kpis.peakDate,
      icon: <Activity className="h-5 w-5 text-warning" />,
      highlight: false
    },
    {
      title: "Demand Growth",
      value: `+${kpis.demandGrowth}%`,
      sub: "vs previous period",
      icon: <ArrowUpRight className="h-5 w-5 text-destructive" />, // using destructive color to imply growing demand might cause stockout risk, or just success. Let's stick to standard colors.
      highlight: false
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((c, i) => (
        <Card key={i} className={c.highlight ? "border-ai/50 shadow-sm bg-ai/5" : ""}>
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start mb-2">
              <span className="text-sm font-medium text-muted-foreground">{c.title}</span>
              <div className="p-1.5 rounded-md bg-background shadow-sm border border-border/50">
                {c.icon}
              </div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${c.highlight ? 'text-ai' : 'text-foreground'}`}>
                {c.value}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
