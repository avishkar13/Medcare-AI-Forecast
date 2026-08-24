"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { mockNetworkForecasts } from "@/lib/mockData";
import { MapPin, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";

export function ForecastNetwork() {
  const networks = mockNetworkForecasts;

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle>Network Demand Forecast</CardTitle>
        <CardDescription>Predicted demand across distribution centers</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {networks.map(dc => (
            <Card key={dc.id} className="border border-border/60 shadow-sm">
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-muted">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="font-semibold text-foreground">{dc.dcName}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Current</p>
                    <p className="text-lg font-medium">{dc.currentDemand}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/50 mx-2" />
                  <div className="text-right">
                    <p className="text-xs text-ai font-medium mb-1">Forecast</p>
                    <p className="text-lg font-bold text-ai">{dc.forecastDemand}</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-border flex justify-between items-center text-sm">
                  <div className="flex items-center gap-1.5">
                    {dc.growth > 0 ? (
                      <TrendingUp className="h-3.5 w-3.5 text-destructive" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5 text-ai" />
                    )}
                    <span className={`font-medium ${dc.growth > 0 ? 'text-destructive' : 'text-ai'}`}>
                      {dc.growth > 0 ? '+' : ''}{dc.growth}%
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">Conf: {dc.confidence}%</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
