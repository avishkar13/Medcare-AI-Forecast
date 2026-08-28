"use client";

import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PLANNING_STAGES, useRunPlanning } from "@/hooks/use-planning";
import { useAuthStore } from "@/store/auth.store";
import { useUiStore } from "@/store/ui.store";
import { cn } from "@/lib/utils";

/**
 * Runs the planner.
 *
 * The engine has been complete since Phase C and had no caller: `POST /planning/runs`
 * was reachable only by starting a what-if from the Simulation page, so a planner who
 * never opened that page saw empty forecast, supply and recommendation surfaces over
 * a working engine. This is the button that was missing.
 *
 * A run takes roughly half a minute and rewrites most of the read model, so it shows
 * the stage it is on rather than an opaque spinner - the executor already reports
 * `currentStage` and `progress` on the run, and nothing was reading them.
 */
export function RunPlanningButton() {
  const { startRun, isRunning, stage, progress } = useRunPlanning();
  // The store mirror, not `useScope`: this renders in the dashboard header, outside
  // any Suspense boundary, and `useScope` reads `useSearchParams`.
  const horizonDays = useUiStore((state) => state.horizonDays);
  const canRun = useAuthStore((state) => state.hasPermission("simulation:run"));

  // The route is gated on `simulation:run`. A VIEWER pressing this would get a 403,
  // so the control says why instead of failing after the fact.
  if (!canRun) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={<Button variant="outline" size="sm" className="h-8 gap-2" disabled />}
        >
          <Play className="h-3.5 w-3.5" />
          <span>Run Planning</span>
        </TooltipTrigger>
        <TooltipContent>Needs the &quot;run simulations&quot; permission</TooltipContent>
      </Tooltip>
    );
  }

  const activeIndex = PLANNING_STAGES.findIndex((entry) => entry.key === stage);
  const label = activeIndex >= 0 ? PLANNING_STAGES[activeIndex]!.label : "Starting";

  return (
    <div className="flex items-center gap-3">
      {isRunning && (
        <div className="hidden items-center gap-2 sm:flex">
          {/* The whole path, not just the current step - a reader can see how far is left. */}
          <div className="flex items-center gap-1" aria-hidden>
            {PLANNING_STAGES.map((entry, index) => (
              <span
                key={entry.key}
                className={cn(
                  "h-1.5 w-4 rounded-full transition-colors",
                  activeIndex >= 0 && index <= activeIndex ? "bg-primary" : "bg-muted",
                )}
              />
            ))}
          </div>
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {label}
            {progress === null ? "" : ` · ${progress}%`}
          </span>
        </div>
      )}

      <Button
        size="sm"
        className="h-8 gap-2 cursor-pointer"
        disabled={isRunning}
        onClick={() => startRun({ horizonDays })}
      >
        {isRunning ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
        <span>{isRunning ? "Planning…" : "Run Planning"}</span>
      </Button>
    </div>
  );
}
