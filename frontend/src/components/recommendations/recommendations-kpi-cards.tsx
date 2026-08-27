"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ListTodo, AlertTriangle, DollarSign, TrendingUp, Zap, BrainCircuit } from "lucide-react";
import {
  useRecommendationIntelligence,
  useRecommendationKpi,
  useRecommendationSummary,
} from "@/hooks/use-recommendations";
import { formatNumber } from "@/lib/utils";
import { useFormatters } from "@/hooks/use-formatters";
import { QueryError } from "@/components/ui/query-state";

export function RecommendationsKpiCards() {
  const { formatCompactCurrency } = useFormatters();
  const { data: kpi, isPending, isError } = useRecommendationKpi();
  const { data: summary } = useRecommendationSummary();
  const { data: intelligence } = useRecommendationIntelligence();

  // the kpi route counts by status, not priority, so the critical count comes from
  // the summary breakdown
  const criticalCount =
    summary?.byPriority.find((row) => row.priority === "CRITICAL")?.count ?? 0;

  if (isPending || !kpi) return null;

  if (isError) return <QueryError label="the recommendation KPIs" />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      
      {/* Pending Actions */}
      <Card className="rounded-xl border-border/60 shadow-sm overflow-hidden hover:border-border/80 transition-colors">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pending Actions</p>
            <div className="h-8 w-8 rounded-full bg-ai/10 flex items-center justify-center">
              <ListTodo className="h-4 w-4 text-ai" />
            </div>
          </div>
          <p className="text-2xl font-black text-foreground">{formatNumber(kpi.open)}</p>
          <div className="mt-2 text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
            <span className="text-foreground/80">{formatNumber(kpi.completed)}</span> completed
          </div>
        </CardContent>
      </Card>

      {/* Critical Actions */}
      <Card className="rounded-xl border-destructive/20 shadow-sm overflow-hidden relative hover:border-destructive/40 transition-colors">
        <div className="absolute top-0 left-0 right-0 h-1 bg-destructive"></div>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Critical Risk</p>
            <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
          </div>
          <p className="text-2xl font-black text-foreground">{formatNumber(criticalCount)}</p>
          <div className="mt-2 text-[11px] font-semibold text-destructive flex items-center gap-1 bg-destructive/10 w-fit px-1.5 py-0.5 rounded">
            Requires immediate review
          </div>
        </CardContent>
      </Card>

      {/* Potential Savings */}
      <Card className="rounded-xl border-success/30 shadow-sm overflow-hidden hover:border-success/50 transition-colors">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Potential Savings</p>
            <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-success" />
            </div>
          </div>
          <p className="text-2xl font-black text-success-foreground tracking-tight">{formatCompactCurrency(kpi.potentialSavings)}</p>
          <div className="mt-2 text-[11px] font-semibold text-success flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            Optimized via AI
          </div>
        </CardContent>
      </Card>

      {/* AI Confidence */}
      <Card className="rounded-xl border-ai/20 shadow-sm overflow-hidden bg-gradient-to-br from-background to-ai/5 hover:border-ai/40 transition-colors">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Avg Confidence</p>
            <div className="h-8 w-8 rounded-full bg-ai/10 flex items-center justify-center">
              <Zap className="h-4 w-4 text-ai" />
            </div>
          </div>
          <p className="text-2xl font-black text-ai flex items-baseline gap-0.5">
            {intelligence?.averageConfidence === null || intelligence?.averageConfidence === undefined
              ? "—"
              : intelligence.averageConfidence}
            <span className="text-base font-bold opacity-80">%</span>
          </p>
          <div className="mt-2 text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
            <BrainCircuit className="h-3 w-3 text-ai" />
            Based on {formatNumber(intelligence?.recommendationCount ?? 0)} recommendations
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
