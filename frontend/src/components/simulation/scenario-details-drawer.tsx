"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AIInsight } from "@/types/simulation";
import { Zap, CheckCircle2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useScope } from "@/hooks/use-scope";

interface ScenarioDetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  insight: AIInsight;
}

export function ScenarioDetailsDrawer({
  open,
  onOpenChange,
  insight,
}: ScenarioDetailsDrawerProps) {
  const scope = useScope();
  const locationText = scope.dc ? `for ${scope.dc}` : "globally";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto p-4">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-ai" />
            AI Recommendations
          </SheetTitle>
          <SheetDescription>
            Contextual actions generated based on simulated parameters {locationText}.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          <div className="p-4 bg-muted/50 rounded-xl border border-border">
            <h4 className="text-sm font-semibold mb-2">Simulation Summary</h4>
            <ul className="space-y-2">
              {insight.insights.map((text, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-ai mt-1.5 shrink-0" />
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Recommended Actions</h4>
            
            <div className="p-3 border border-border rounded-lg bg-background shadow-sm space-y-2 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-ai" />
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-ai" />
                {insight.suggestedResponse || "Review inventory policies."}
              </div>
              <p className="text-xs text-muted-foreground pl-6">
                Based on the elevated risks in this scenario, immediate action is required to prevent stockouts and minimize holding costs.
              </p>
            </div>

            <div className="p-3 border border-border rounded-lg bg-background shadow-sm space-y-2 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-warning" />
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-warning" />
                Rebalance stock levels across regional DCs.
              </div>
              <p className="text-xs text-muted-foreground pl-6">
                Transfer excess inventory from low-risk facilities to mitigate impending shortages.
              </p>
            </div>
            
            <div className="p-3 border border-border rounded-lg bg-background shadow-sm space-y-2 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-success" />
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Expedite critical supplier orders.
              </div>
              <p className="text-xs text-muted-foreground pl-6">
                Approve pending recommendations for priority air freight to close the supply gap.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-border mt-6">
            <Link 
              href="/recommendations"
              className="w-full flex items-center justify-center gap-2 bg-ai text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors hover:bg-ai/90"
              onClick={() => onOpenChange(false)}
            >
              View Full Recommendations <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
