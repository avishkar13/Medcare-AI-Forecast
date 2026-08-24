"use client";

import { Card, CardContent } from "@/components/ui/card";
// import { Badge } from "@/components/ui/badge";
import { AIInsight } from "@/types/simulation";
import { BrainCircuit, ShieldAlert, Zap, Lightbulb, ArrowRight } from "lucide-react";

interface AIScenarioAssessmentProps {
  insight: AIInsight;
}

const RISK_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  low: { bg: "bg-success/10 border-success/30", text: "text-success", label: "LOW RISK" },
  moderate: { bg: "bg-warning/10 border-warning/30", text: "text-warning", label: "MODERATE RISK" },
  high: { bg: "bg-warning/20 border-warning/40", text: "text-warning", label: "HIGH RISK" },
  critical: { bg: "bg-destructive/10 border-destructive/30", text: "text-destructive", label: "CRITICAL" },
};

export function AIScenarioAssessment({ insight }: AIScenarioAssessmentProps) {
  const style = RISK_STYLES[insight.overallRisk];

  return (
    <Card className={`rounded-xl shadow-sm border ${style.bg}`}>
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <BrainCircuit className="h-5 w-5 text-ai" />
          <h3 className="text-lg font-bold text-foreground">AI Scenario Assessment</h3>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-5">
          {/* Overall risk */}
          <div className={`flex-1 p-4 rounded-xl border ${style.bg} text-center`}>
            <ShieldAlert className={`h-8 w-8 mx-auto mb-2 ${style.text}`} />
            <p className={`text-xl font-black uppercase tracking-wider ${style.text}`}>{style.label}</p>
            <p className="text-[10px] text-muted-foreground font-medium mt-1">Overall Assessment</p>
          </div>

          {/* Confidence */}
          <div className="flex-1 p-4 rounded-xl border border-ai/20 bg-ai/5 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-ai mb-1">Simulation Confidence</p>
            <p className="text-3xl font-black text-ai">{insight.confidence}<span className="text-base font-bold opacity-80">%</span></p>
          </div>
        </div>

        {/* Insights */}
        <div className="space-y-2.5 mb-5">
          {insight.insights.map((text, i) => (
            <div key={i} className="flex items-start gap-2.5 p-2.5 bg-background/60 rounded-lg border border-border/40">
              <Lightbulb className="h-3.5 w-3.5 text-ai shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-foreground leading-relaxed">{text}</p>
            </div>
          ))}
        </div>

        {/* Suggested response */}
        <div className="p-4 bg-ai/10 rounded-xl border border-ai/30 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-ai" />
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-ai fill-ai/20" />
              <p className="text-[11px] font-black text-ai uppercase tracking-wider">Suggested Action Plan</p>
            </div>
            <button className="flex items-center gap-1 mt-0 text-[10px] font-bold text-ai hover:text-ai/80 transition-colors">
              View details <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <p className="text-sm font-semibold text-foreground leading-relaxed pl-1">{insight.suggestedResponse}</p>
        </div>
      </CardContent>
    </Card>
  );
}
