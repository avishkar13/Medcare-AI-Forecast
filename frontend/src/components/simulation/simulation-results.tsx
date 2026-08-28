"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SimulationMetric } from "@/types/simulation";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

import { useFormatters } from "@/hooks/use-formatters";

interface SimulationResultsProps {
  metrics: SimulationMetric[];
}

export function SimulationResults({ metrics }: SimulationResultsProps) {
  const { formatCompactCurrency } = useFormatters();

  const formatValue = (value: number, format: SimulationMetric["format"], unit: string): string => {
    if (format === "currency") {
      return formatCompactCurrency(value);
    }
    return `${value}${unit}`;
  };

  const formatDelta = (delta: number, format: SimulationMetric["format"], unit: string): string => {
    const sign = delta > 0 ? "+" : "";
    if (format === "currency") {
      return `${sign}${formatCompactCurrency(Math.abs(delta))}`;
    }
    return `${sign}${delta}${unit}`;
  };

  return (
    <Card className="rounded-xl border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-bold">Simulation Results</CardTitle>
        <p className="text-xs text-muted-foreground font-medium">
          Current network state compared with the simulated scenario.
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className={`
                relative p-4 rounded-xl border overflow-hidden transition-colors
                ${metric.direction === "negative" ? "border-destructive/20 bg-destructive/5" :
                  metric.direction === "positive" ? "border-success/20 bg-success/5" :
                  "border-border/60 bg-background"}
              `}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                {metric.label}
              </p>

              <div className="flex items-end justify-between gap-2">
                {/* Current */}
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Current</p>
                  <p className="text-base font-bold text-foreground/70 tabular-nums">
                    {formatValue(metric.currentValue, metric.format, metric.unit)}
                  </p>
                </div>

                {/* Arrow */}
                <div className="pb-1.5 text-muted-foreground/50 font-light">→</div>

                {/* Simulated */}
                <div className="text-right">
                  <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Simulated</p>
                  <p className={`text-lg font-black tabular-nums tracking-tight ${
                    metric.direction === "negative" ? "text-destructive" :
                    metric.direction === "positive" ? "text-success" :
                    "text-foreground"
                  }`}>
                    {formatValue(metric.simulatedValue, metric.format, metric.unit)}
                  </p>
                </div>
              </div>

              {/* Delta badge */}
              <div className={`
                absolute top-3 right-3 flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10.5px] font-bold tabular-nums tracking-tight
                ${metric.direction === "negative" ? "bg-destructive/10 text-destructive" :
                  metric.direction === "positive" ? "bg-success/10 text-success" :
                  "bg-muted text-muted-foreground"}
              `}>
                {metric.direction === "negative" ? <ArrowUp className="h-3 w-3 mr-0.5" /> :
                 metric.direction === "positive" ? <ArrowDown className="h-3 w-3 mr-0.5" /> :
                 <Minus className="h-3 w-3 mr-0.5" />}
                {formatDelta(metric.delta, metric.format, metric.unit)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
