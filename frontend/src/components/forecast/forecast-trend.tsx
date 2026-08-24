"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mockForecastTrends } from "@/lib/mockData";
import { BarChart3, TrendingUp, Calendar, Zap } from "lucide-react";

export function ForecastTrend() {
  const trends = mockForecastTrends;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          Demand Trend Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-y-6 gap-x-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">7-Day Trend</p>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-destructive" />
              <span className="text-lg font-semibold">+{trends.sevenDayTrend}%</span>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">30-Day Trend</p>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-destructive" />
              <span className="text-lg font-semibold">+{trends.thirtyDayTrend}%</span>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Seasonal Pattern</p>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-ai" />
              <span className="text-sm font-semibold">{trends.seasonalPattern}</span>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Volatility</p>
            <div className="flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-success" />
              <span className="text-sm font-semibold">{trends.demandVolatility}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
