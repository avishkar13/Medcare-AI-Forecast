"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScenarioPreset } from "@/types/simulation";
import { SCENARIO_PRESETS } from "@/lib/simulationEngine";
import { TrendingUp, Truck, PackageMinus, PackagePlus, Zap, BarChart3 } from "lucide-react";

interface ScenarioSelectorProps {
  selected: ScenarioPreset;
  onSelect: (preset: ScenarioPreset) => void;
}

const PRESET_ICONS: Record<ScenarioPreset, React.ReactNode> = {
  baseline: <BarChart3 className="h-4 w-4" />,
  "demand-surge": <TrendingUp className="h-4 w-4" />,
  "supplier-delay": <Truck className="h-4 w-4" />,
  "inventory-shortage": <PackageMinus className="h-4 w-4" />,
  overstock: <PackagePlus className="h-4 w-4" />,
  "combined-stress": <Zap className="h-4 w-4" />,
};

export function ScenarioSelector({ selected, onSelect }: ScenarioSelectorProps) {
  const presets = Object.entries(SCENARIO_PRESETS) as [ScenarioPreset, typeof SCENARIO_PRESETS[ScenarioPreset]][];

  return (
    <Card className="rounded-xl border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          Build a Scenario
        </CardTitle>
        <p className="text-xs text-muted-foreground font-medium">
          Adjust supply chain conditions and see how the network responds.
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Scenario Preset</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {presets.map(([key, preset]) => (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={`
                relative flex flex-col items-start gap-1.5 p-3 rounded-lg border text-left transition-all duration-200 group
                ${selected === key
                  ? "bg-ai/10 border-ai/40 text-ai shadow-[0_0_0_1px_rgba(13,148,136,0.3)] ring-1 ring-ai/30"
                  : "bg-background border-border/60 hover:border-border hover:bg-muted/40 hover:shadow-sm text-foreground"
                }
              `}
            >
              <div className={`p-1.5 rounded-md transition-colors ${selected === key ? "bg-ai/20 text-ai" : "bg-muted/50 text-muted-foreground group-hover:text-foreground"}`}>
                {PRESET_ICONS[key]}
              </div>
              <div>
                <p className="text-xs font-bold">{preset.label}</p>
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{preset.description}</p>
              </div>
              {selected === key && (
                <div className="absolute top-2.5 right-2.5 h-1.5 w-1.5 rounded-full bg-ai animate-in fade-in zoom-in" />
              )}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
