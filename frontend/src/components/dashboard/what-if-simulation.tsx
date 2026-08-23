"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Play, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

export function WhatIfSimulation() {
  const [demandChange, setDemandChange] = useState(0);
  const [leadTimeChange, setLeadTimeChange] = useState(0);
  const [simulating, setSimulating] = useState(false);
  const [hasSimulated, setHasSimulated] = useState(false);

  // Mock calculation based on inputs
  const currentRisk = 4.2;
  const simulatedRisk = Math.max(0.1, currentRisk + (demandChange * 0.15) + (leadTimeChange * 1.2));
  
  const currentCost = 49300;
  const simulatedCost = currentCost * (1 + (demandChange * 0.008)) * (1 + (leadTimeChange * 0.05));

  const handleSimulate = () => {
    setSimulating(true);
    setTimeout(() => {
      setSimulating(false);
      setHasSimulated(true);
    }, 800);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
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
              <p className="max-w-xs">Stress-test the network. Adjust macroeconomic variables to instantly simulate the impact on stockout risk and holding costs.</p>
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
              <span className="text-sm font-semibold font-mono">{demandChange > 0 ? '+' : ''}{demandChange}%</span>
            </div>
            <input 
              type="range" 
              min="-50" max="100" step="5" 
              value={demandChange} 
              onChange={(e) => { setDemandChange(parseInt(e.target.value)); setHasSimulated(false); }}
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
              <span className="text-sm font-semibold font-mono">{leadTimeChange > 0 ? '+' : ''}{leadTimeChange}d</span>
            </div>
            <input 
              type="range" 
              min="-5" max="14" step="1" 
              value={leadTimeChange} 
              onChange={(e) => { setLeadTimeChange(parseInt(e.target.value)); setHasSimulated(false); }}
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
                <span className="text-lg font-bold">{currentRisk.toFixed(1)}%</span>
              </div>
              <div className="flex flex-col gap-0.5 mt-1">
                <span className="text-[11px] text-muted-foreground">Total Cost</span>
                <span className="text-lg font-bold">{formatCurrency(currentCost)}</span>
              </div>
            </div>

            <div className={`flex flex-col gap-2 p-3 rounded-lg border transition-all ${hasSimulated ? 'bg-primary/5 border-primary/20' : 'bg-muted/10 border-transparent opacity-60'}`}>
              <span className={`text-xs font-medium uppercase tracking-wider ${hasSimulated ? 'text-primary' : 'text-muted-foreground'}`}>Simulated</span>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-muted-foreground">Stockout Risk</span>
                <span className={`text-lg font-bold tabular-nums ${hasSimulated ? (simulatedRisk > 10 ? 'text-destructive' : simulatedRisk > 5 ? 'text-warning' : 'text-success') : ''}`}>
                  {hasSimulated ? `${simulatedRisk.toFixed(1)}%` : '-'}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 mt-1">
                <span className="text-[11px] text-muted-foreground">Total Cost</span>
                <span className={`text-lg font-bold tabular-nums ${hasSimulated ? (simulatedCost > currentCost * 1.2 ? 'text-destructive' : 'text-foreground') : ''}`}>
                  {hasSimulated ? formatCurrency(simulatedCost) : '-'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4">
            {hasSimulated && simulatedRisk > 15 && (
              <div className="flex items-center justify-between p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <span className="text-xs font-medium text-destructive">Capacity expansion required.</span>
                <Badge variant="destructive" className="bg-destructive text-white border-transparent">Critical</Badge>
              </div>
            )}
            {hasSimulated && simulatedRisk <= 15 && simulatedRisk > currentRisk && (
              <div className="flex items-center justify-between p-3 bg-warning/10 border border-warning/20 rounded-md">
                <span className="text-xs font-medium text-warning">Increase safety stock by 15% recommended.</span>
                <Badge variant="outline" className="bg-warning text-white border-transparent">Warning</Badge>
              </div>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-0 pb-6 px-6">
        <Button 
          className="w-full gap-2 cursor-pointer transition-all" 
          onClick={handleSimulate}
          disabled={simulating}
        >
          {simulating ? (
            <div className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {simulating ? "Simulating Network..." : "Run Simulation"}
        </Button>
      </CardFooter>
    </Card>
  );
}
