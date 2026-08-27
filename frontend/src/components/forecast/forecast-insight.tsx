"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useForecastInsight } from "@/hooks/use-forecast";
import { BrainCircuit, AlertTriangle, Lightbulb } from "lucide-react";
import { useForecastScope } from "@/store/filters.store";
import { QueryError } from "@/components/ui/query-state";

export function ForecastInsight() {
  const scope = useForecastScope();
  const { data, isPending, isError } = useForecastInsight(scope);

  // the api returns observations with their numbers rather than written prose
  const by = (kind: string) =>
    data?.observations.find((o) => o.kind === kind)?.detail ?? "";

  const insight = {
    keyDriver: by("trend") || by("network"),
    riskImplication: by("uncertainty"),
    confidence: "Medium" as const,
    recommendedAttention: by("network"),
    detailedInsight: (data?.observations ?? []).map((o) => o.detail).join(" "),
  };

  if (isPending) return null;

  if (isError) return <QueryError label="forecast insights" />;

  return (
    <Card className="h-full border-ai/50 shadow-sm bg-gradient-to-br from-background to-ai/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-ai">
          <BrainCircuit className="h-4 w-4" />
          AI Forecast Insight
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        <p className="text-sm leading-relaxed text-foreground">
          {insight.detailedInsight}
        </p>

        <div className="space-y-3 pt-3 border-t border-border/50">
          <div className="flex gap-2 items-start">
            <div className="mt-0.5">
              <Lightbulb className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Key Driver</p>
              <p className="text-xs text-muted-foreground">{insight.keyDriver}</p>
            </div>
          </div>
          
          <div className="flex gap-2 items-start">
            <div className="mt-0.5">
              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Risk Implication</p>
              <p className="text-xs text-muted-foreground">{insight.riskImplication}</p>
            </div>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
