"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useForecastNetwork } from "@/hooks/use-forecast";
import { MapPin, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { useForecastScope } from "@/store/filters.store";
import { useScope } from "@/hooks/use-scope";
import { QueryError } from "@/components/ui/query-state";

export function ForecastNetwork() {
  const scope = useForecastScope();
  const { dc: activeDc } = useScope();
  const { data, isPending, isError } = useForecastNetwork(scope);

  // confidence and a per-dc peak are not exposed per warehouse
  const allNetworks = (data?.items ?? []).map((dc) => ({
    id: dc.code,
    warehouseId: dc.warehouseId,
    dcName: dc.name,
    currentDemand: dc.recentDemand30d ?? 0,
    forecastDemand: dc.forecastDemand ?? 0,
    growth: dc.growthPercent ?? 0,
    confidence: 0,
    peakDemand: 0,
    peakDate: "",
  }));

  // The API always returns every DC. If a global DC is active, narrow it client-side.
  const networks = activeDc
    ? allNetworks.filter((n) => n.warehouseId === activeDc)
    : allNetworks;

  if (isPending) return null;

  if (isError) return <QueryError label="the forecast by DC" />;

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle>Network Demand Forecast</CardTitle>
        <CardDescription>Predicted demand across distribution centers</CardDescription>
      </CardHeader>
      <CardContent>
        {networks.length === 1 ? (
          /* ── Single DC: expanded horizontal layout ── */
          (() => {
            const dc = networks[0]!;
            const absGrowth = Math.abs(dc.growth);
            const isUp = dc.growth > 0;
            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {/* Left: DC identity + growth badge */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ai/10 border border-ai/20">
                      <MapPin className="h-4.5 w-4.5 text-ai" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground leading-tight">{dc.dcName}</p>
                      <p className="text-[11px] text-muted-foreground">Isolated view</p>
                    </div>
                  </div>
                  <div className={`inline-flex items-center gap-1.5 self-start rounded-full border px-2.5 py-1 text-xs font-medium ${
                    isUp
                      ? "border-destructive/25 bg-destructive/10 text-destructive"
                      : "border-ai/25 bg-ai/10 text-ai"
                  }`}>
                    {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {isUp ? "+" : ""}{dc.growth}% growth
                  </div>
                </div>

                {/* Centre: Current → Forecast with progress bar */}
                <div className="flex flex-col justify-center gap-2">
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Current (30d)</p>
                      <p className="text-xl font-bold text-foreground">{dc.currentDemand.toLocaleString()}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/40 mx-3 shrink-0" />
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider text-ai font-semibold">Forecast</p>
                      <p className="text-xl font-bold text-ai">{dc.forecastDemand.toLocaleString()}</p>
                    </div>
                  </div>
                  {/* Visual proportion bar */}
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-ai/60 to-ai transition-all duration-500"
                      style={{
                        width: `${Math.min(100, dc.forecastDemand && dc.currentDemand
                          ? (dc.currentDemand / dc.forecastDemand) * 100
                          : 50
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Current demand is {dc.forecastDemand
                      ? `${((dc.currentDemand / dc.forecastDemand) * 100).toFixed(0)}%`
                      : "—"} of forecast
                  </p>
                </div>

                {/* Right: delta summary */}
                <div className="flex flex-col justify-center gap-1.5 rounded-xl border border-border/60 bg-muted/15 p-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Demand Delta</p>
                  <p className={`text-2xl font-bold ${isUp ? "text-destructive" : "text-ai"}`}>
                    {isUp ? "+" : ""}{(dc.forecastDemand - dc.currentDemand).toLocaleString()}
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {isUp
                      ? `Forecast exceeds 30-day actuals by ${absGrowth}%.`
                      : `Forecast is ${absGrowth}% below 30-day actuals.`}
                  </p>
                </div>
              </div>
            );
          })()
        ) : (
          /* ── Multiple DCs: compact card grid ── */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {networks.map(dc => (
              <Card key={dc.id} className="border border-border/60 shadow-sm bg-background">
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
        )}
      </CardContent>
    </Card>
  );
}
