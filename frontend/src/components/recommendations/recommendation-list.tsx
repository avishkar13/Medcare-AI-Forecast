"use client";

import { RecommendationItem } from "@/types/recommendation";
import { RecommendationCard } from "./recommendation-card";

interface RecommendationListProps {
  recommendations: RecommendationItem[];
  onExecute: (id: string) => void;
  onDismiss: (id: string) => void;
}

export function RecommendationList({ recommendations, onExecute, onDismiss }: RecommendationListProps) {
  return (
    <div className="flex flex-col h-full bg-background border border-border/50 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-border/50 flex items-center justify-between bg-muted/10 shrink-0">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            Recommended Actions
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Prioritized actions generated from demand, inventory, and network signals.
          </p>
        </div>
        <div className="bg-ai/10 text-ai border border-ai/20 font-semibold px-2.5 py-1 rounded-md text-xs uppercase tracking-wider shrink-0 flex items-center gap-1.5">
          <span className="flex h-2 w-2 rounded-full bg-ai animate-pulse"></span>
          {recommendations.length} Shown
        </div>
      </div>

      <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-3.5 pr-2 sm:pr-3 custom-scrollbar">
        {recommendations.length > 0 ? (
          recommendations.map(rec => (
            <RecommendationCard
              key={rec.id}
              recommendation={rec}
              onExecute={onExecute}
              onDismiss={onDismiss}
            />
          ))
        ) : (
          <div className="h-40 flex flex-col items-center justify-center text-muted-foreground">
            <p className="font-medium text-foreground">No recommendations found</p>
            <p className="text-sm">Try adjusting your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
