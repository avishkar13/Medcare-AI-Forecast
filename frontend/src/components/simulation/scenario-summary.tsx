"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SimulationParams, ScenarioPreset } from "@/types/simulation";
import { SCENARIO_PRESETS } from "@/lib/simulationEngine";
import { BrainCircuit } from "lucide-react";

interface ScenarioSummaryProps {
  preset: ScenarioPreset;
  params: SimulationParams;
  summary: string;
}

export function ScenarioSummary({ preset, params, summary }: ScenarioSummaryProps) {
  const presetLabel = SCENARIO_PRESETS[preset].label;

  const paramRows = [
    { label: "Demand Shock", value: `${params.demandShock > 0 ? "+" : ""}${params.demandShock}%` },
    { label: "Supplier Lead Time", value: `${params.supplierLeadTime > 0 ? "+" : ""}${params.supplierLeadTime} days` },
    { label: "Inventory", value: `${params.inventoryAvailability}%` },
    { label: "Capacity", value: `${params.distributionCapacity}%` },
    { label: "Service Target", value: `${params.serviceLevelTarget}%` },
    { label: "Transport Cost", value: `${params.transportationCost > 0 ? "+" : ""}${params.transportationCost}%` },
  ];

  return (
    <Card className="rounded-xl border-border/60 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold">Scenario Summary</CardTitle>
          <Badge variant="outline" className="bg-ai/10 text-ai border-ai/20 text-xs font-semibold uppercase tracking-wider px-2.5">
            {presetLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 mb-4">
          {paramRows.map((row) => (
            <div key={row.label} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">{row.label}</span>
              <span className="font-bold text-foreground tabular-nums">{row.value}</span>
            </div>
          ))}
        </div>
        <div className="p-3 bg-muted/30 rounded-lg border border-border/50 flex gap-2 items-start">
          <BrainCircuit className="h-4 w-4 shrink-0 text-ai/70 mt-0.5" />
          <p className="text-xs font-medium text-muted-foreground leading-relaxed">{summary}</p>
        </div>
      </CardContent>
    </Card>
  );
}
