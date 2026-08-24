"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SimulationParams, ParamConfig } from "@/types/simulation";
import { RotateCcw, Info } from "lucide-react";

const LEFT_PARAMS: ParamConfig[] = [
  {
    key: "demandShock",
    label: "Demand Shock",
    min: -50,
    max: 100,
    step: 5,
    unit: "%",
    baseline: 0,
    tooltip: "Simulates a sudden increase or decrease in product demand across the network.",
    format: (v) => `${v > 0 ? "+" : ""}${v}%`,
  },
  {
    key: "inventoryAvailability",
    label: "Inventory Availability",
    min: 50,
    max: 120,
    step: 5,
    unit: "%",
    baseline: 100,
    tooltip: "Adjusts the overall inventory availability level relative to the current position.",
    format: (v) => `${v}%`,
  },
  {
    key: "serviceLevelTarget",
    label: "Service Level Target",
    min: 80,
    max: 99,
    step: 1,
    unit: "%",
    baseline: 95,
    tooltip: "The target percentage of orders to be fulfilled without stockouts.",
    format: (v) => `${v}%`,
  },
];

const RIGHT_PARAMS: ParamConfig[] = [
  {
    key: "supplierLeadTime",
    label: "Supplier Lead Time",
    min: -5,
    max: 14,
    step: 1,
    unit: "days",
    baseline: 0,
    tooltip: "Change in supplier lead time. Positive values simulate delays.",
    format: (v) => `${v > 0 ? "+" : ""}${v} days`,
  },
  {
    key: "distributionCapacity",
    label: "Distribution Capacity",
    min: 50,
    max: 120,
    step: 5,
    unit: "%",
    baseline: 100,
    tooltip: "Adjusts available distribution center capacity across the network.",
    format: (v) => `${v}%`,
  },
  {
    key: "transportationCost",
    label: "Transportation Cost",
    min: -20,
    max: 100,
    step: 5,
    unit: "%",
    baseline: 0,
    tooltip: "Change in freight and transportation cost relative to current rates.",
    format: (v) => `${v > 0 ? "+" : ""}${v}%`,
  },
];

interface SimulationParametersProps {
  params: SimulationParams;
  onChange: (key: keyof SimulationParams, value: number) => void;
  onReset: () => void;
}

function ParamSlider({ config, value, onChange }: { config: ParamConfig; value: number; onChange: (v: number) => void }) {
  const pct = ((value - config.min) / (config.max - config.min)) * 100;
  const baselinePct = ((config.baseline - config.min) / (config.max - config.min)) * 100;
  const isModified = value !== config.baseline;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-foreground">{config.label}</span>
          <Tooltip>
            <TooltipTrigger>
              <span className="inline-flex">
                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px] text-xs">
              {config.tooltip}
            </TooltipContent>
          </Tooltip>
        </div>
        <span className={`text-sm font-bold tabular-nums tracking-tight ${isModified ? "text-ai" : "text-foreground"}`}>
          {config.format(value)}
        </span>
      </div>
      <div className="relative pt-1 pb-2">
        {/* Baseline marker */}
        <div 
          className="absolute top-0 h-3.5 w-0.5 bg-muted-foreground/30 z-0 rounded-full" 
          style={{ left: `calc(${baselinePct}% - 1px)` }}
          title={`Baseline: ${config.format(config.baseline)}`}
        />
        
        <input
          type="range"
          min={config.min}
          max={config.max}
          step={config.step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer relative z-10
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ai [&::-webkit-slider-thumb]:shadow-md
            [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background
            [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform"
          style={{
            background: `linear-gradient(to right, var(--ai) 0%, var(--ai) ${pct}%, var(--border) ${pct}%, var(--border) 100%)`,
          }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground font-medium -mt-1">
        <span>{config.format(config.min)}</span>
        <span>{config.format(config.max)}</span>
      </div>
    </div>
  );
}

export function SimulationParameters({ params, onChange, onReset }: SimulationParametersProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="rounded-xl border-border/60 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            Demand &amp; Inventory
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {LEFT_PARAMS.map((config) => (
            <ParamSlider
              key={config.key}
              config={config}
              value={params[config.key]}
              onChange={(v) => onChange(config.key, v)}
            />
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/60 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              Supply &amp; Network
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onReset} className="text-xs text-muted-foreground h-7 px-2 hover:text-foreground">
              <RotateCcw className="h-3 w-3 mr-1.5" />
              Reset Parameters
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {RIGHT_PARAMS.map((config) => (
            <ParamSlider
              key={config.key}
              config={config}
              value={params[config.key]}
              onChange={(v) => onChange(config.key, v)}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
