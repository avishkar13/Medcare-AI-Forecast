"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ListTodo, AlertTriangle, DollarSign, TrendingUp, Zap, BrainCircuit } from "lucide-react";

export function RecommendationsKpiCards() {
  const metrics = {
    pendingCount: 5,
    executedCount: 12,
    criticalCount: 2,
    totalSavings: 17800,
    avgConfidence: 89.4
  };

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
          <p className="text-2xl font-black text-foreground">{metrics.pendingCount}</p>
          <div className="mt-2 text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
            <span className="text-foreground/80">{metrics.executedCount}</span> executed today
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
          <p className="text-2xl font-black text-foreground">{metrics.criticalCount}</p>
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
          <p className="text-2xl font-black text-success-foreground tracking-tight">${(metrics.totalSavings / 1000).toFixed(1)}K</p>
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
            {metrics.avgConfidence}<span className="text-base font-bold opacity-80">%</span>
          </p>
          <div className="mt-2 text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
            <BrainCircuit className="h-3 w-3 text-ai" />
            Based on {metrics.pendingCount + metrics.executedCount} predictions
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
