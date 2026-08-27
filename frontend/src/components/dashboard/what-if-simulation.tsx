"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Play, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useWhatIf } from "@/hooks/use-simulation";
import { useLatestRunOutcome } from "@/hooks/use-planning";
import { useFormatters } from "@/hooks/use-formatters";

export function WhatIfSimulation() {
  const [demandChange, setDemandChange] = useState(0);
  const [leadTimeChange, setLeadTimeChange] = useState(0);
  // Was a module-level formatter hardcoded to USD, which no setting could reach.
  const { formatCurrency } = useFormatters();

  const baseline = useLatestRunOutcome();
  const whatIf = useWhatIf();

  const currentRisk = baseline.simulation?.stockoutProbabilityPercent ?? 0;
  const currentCost = baseline.optimization?.totalCost ?? 0;

  const simulatedRisk = whatIf.simulation?.stockoutProbabilityPercent ?? 0;
  const simulatedCost = whatIf.optimization?.totalCost ?? 0;
  const hasSimulated = Boolean(whatIf.simulation && whatIf.optimization);

  const handleSimulate = () => {
    whatIf.start.mutate({
      name: `Dashboard what-if ${new Date().toISOString()}`,
      params: {
        demandShockPercent: demandChange,
        // sent as days; the server converts against the real average lead time
        leadTimeChangeDays: leadTimeChange,
      },
    });
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-4 border-b border-border/50">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-ai" />
          What-If Simulation
          <Tooltip>
            <TooltipTrigger render={<Info className="h-4 w-4 text-muted-foreground cursor-help" />} />
            <TooltipContent>
              <p className="max-w-xs">Stress-test the network. Adjust the inputs to run a planning scenario and compare its stockout risk and cost against the latest plan.</p>
            </TooltipContent>
          </Tooltip>
        </CardTitle>
        <CardDescription>Stress-test supply chain scenarios</CardDescription>
      </CardHeader>
      <CardContent className="pt-6 flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Demand Shock (%)</label>
              <span className="text-sm font-semibold font-mono">{demandChange > 0 ? "+" : ""}{demandChange}%</span>
            </div>
            <input
              type="range"
              min="-50" max="100" step="5"
              value={demandChange}
              onChange={(e) => setDemandChange(parseInt(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground uppercase">
              <span>-50%</span>
              <span>Baseline</span>
              <span>+100%</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Supplier Lead Time (Days)</label>
              <span className="text-sm font-semibold font-mono">{leadTimeChange > 0 ? "+" : ""}{leadTimeChange}d</span>
            </div>
            <input
              type="range"
              min="-5" max="14" step="1"
              value={leadTimeChange}
              onChange={(e) => setLeadTimeChange(parseInt(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground uppercase">
              <span>-5d</span>
              <span>Baseline</span>
              <span>+14d</span>
            </div>
          </div>
        </div>

        <div className="relative rounded-lg border border-border bg-muted/20 p-4">
          <div className="absolute -top-3 left-4 bg-background px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Output Projection
          </div>

          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="flex flex-col gap-2 p-3 bg-muted/50 rounded-lg">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Current State</span>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-muted-foreground">Stockout Risk</span>
                <span className="text-lg font-bold">{baseline.hasRun ? `${currentRisk}%` : "-"}</span>
              </div>
              <div className="flex flex-col gap-0.5 mt-1">
                <span className="text-[11px] text-muted-foreground">Total Cost</span>
                <span className="text-lg font-bold">{baseline.hasRun ? formatCurrency(currentCost) : "-"}</span>
              </div>
            </div>

            <div className={`flex flex-col gap-2 p-3 rounded-lg border transition-all ${hasSimulated ? "bg-primary/5 border-primary/20" : "bg-muted/10 border-transparent opacity-60"}`}>
              <span className={`text-xs font-medium uppercase tracking-wider ${hasSimulated ? "text-primary" : "text-muted-foreground"}`}>Simulated</span>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-muted-foreground">Stockout Risk</span>
                <span className={`text-lg font-bold tabular-nums ${hasSimulated ? (simulatedRisk > 10 ? "text-destructive" : simulatedRisk > 5 ? "text-warning" : "text-success") : ""}`}>
                  {hasSimulated ? `${simulatedRisk}%` : "-"}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 mt-1">
                <span className="text-[11px] text-muted-foreground">Total Cost</span>
                <span className={`text-lg font-bold tabular-nums ${hasSimulated && simulatedCost > currentCost ? "text-destructive" : ""}`}>
                  {hasSimulated ? formatCurrency(simulatedCost) : "-"}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4">
            {whatIf.failed && (
              <div className="flex items-center justify-between p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <span className="text-xs font-medium text-destructive">
                  {whatIf.failureReason ?? "The run failed."}
                </span>
                <Badge variant="destructive" className="bg-destructive text-white border-transparent">Failed</Badge>
              </div>
            )}
            {hasSimulated && simulatedRisk > currentRisk && (
              <div className="flex items-center justify-between p-3 bg-warning/10 border border-warning/20 rounded-md">
                <span className="text-xs font-medium text-warning">
                  Stockout risk is {simulatedRisk}% against {currentRisk}% on the latest plan.
                </span>
                <Badge variant="outline" className="bg-warning text-white border-transparent">Warning</Badge>
              </div>
            )}
            {hasSimulated && simulatedRisk <= currentRisk && (
              <div className="flex items-center justify-between p-3 bg-success/10 border border-success/20 rounded-md">
                <span className="text-xs font-medium text-success">
                  Stockout risk holds at or below the latest plan.
                </span>
                <Badge variant="outline" className="bg-success text-white border-transparent">Stable</Badge>
              </div>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-0 pb-6 px-6">
        <Button
          className="w-full gap-2 cursor-pointer transition-all"
          onClick={handleSimulate}
          disabled={whatIf.isRunning}
        >
          {whatIf.isRunning ? (
            <div className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {whatIf.isRunning ? "Simulating Network..." : "Run Simulation"}
        </Button>
      </CardFooter>
    </Card>
  );
}
