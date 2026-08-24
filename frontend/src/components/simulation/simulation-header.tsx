"use client";

import { Button } from "@/components/ui/button";
import { Play, RotateCcw, Loader2 } from "lucide-react";

interface SimulationHeaderProps {
  lastSimulation: string | null;
  isSimulating: boolean;
  onRun: () => void;
  onReset: () => void;
}

export function SimulationHeader({ lastSimulation, isSimulating, onRun, onReset }: SimulationHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-4 sm:pt-6 mb-2">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-ai mb-1">
          What-If Scenario Planning
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Supply Chain Simulation</h1>
        <p className="text-sm text-muted-foreground mt-1 font-medium">
          Stress-test supply chain scenarios before making operational decisions.
        </p>
      </div>

      <div className="flex items-center gap-3">
        {lastSimulation && (
          <p className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap hidden sm:block">
            Last simulation: {lastSimulation}
          </p>
        )}
        <Button variant="outline" size="sm" className="bg-background text-xs font-semibold h-8" onClick={onReset}>
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Reset
        </Button>
        <Button
          size="sm"
          className="bg-ai hover:bg-ai/90 text-primary-foreground font-bold shadow-md h-8 px-4 transition-all duration-200"
          onClick={onRun}
          disabled={isSimulating}
        >
          {isSimulating ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Simulating...
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 mr-1.5" />
              Run Simulation
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
