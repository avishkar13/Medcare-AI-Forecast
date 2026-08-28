"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RiskIndicator } from "@/types/simulation";
import { AlertTriangle, Clock, Server, DollarSign, BrainCircuit, ArrowRight } from "lucide-react";
import { useFormatters } from "@/hooks/use-formatters";

interface RiskAnalysisProps {
  risks: RiskIndicator[];
  aiInterpretation: string;
}

const RISK_ICONS: Record<string, React.ReactNode> = {
  AlertTriangle: <AlertTriangle className="h-4 w-4" />,
  Clock: <Clock className="h-4 w-4" />,
  Server: <Server className="h-4 w-4" />,
  DollarSign: <DollarSign className="h-4 w-4" />,
};

const SEVERITY_STYLES: Record<string, string> = {
  low: "bg-success/10 text-success border-success/20",
  moderate: "bg-warning/10 text-warning border-warning/20",
  high: "bg-warning/20 text-warning border-warning/30",
  critical: "bg-destructive/10 text-destructive border-destructive/20",
};

export function RiskAnalysis({ risks, aiInterpretation }: RiskAnalysisProps) {
  const { formatCompactCurrency } = useFormatters();
  return (
    <Card className="rounded-xl border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-bold">Risk Analysis</CardTitle>
        <p className="text-xs text-muted-foreground font-medium">How the scenario changes operational risk.</p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {risks.map((risk) => {
            const isUnit = risk.name === "Stockout Risk" || risk.name === "Capacity Risk";
            const formatVal = (v: number) => isUnit ? `${v}%` : formatCompactCurrency(v);
            const formatDelta = () => {
              if (isUnit) return `${risk.delta > 0 ? "+" : ""}${risk.delta}%`;
              return `${risk.delta > 0 ? "+" : ""}${risk.delta}%`;
            };

            return (
              <div key={risk.name} className={`p-3.5 rounded-xl border ${risk.severity === "critical" || risk.severity === "high" ? "bg-destructive/5 border-destructive/20" : "border-border/50 bg-background"}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-1.5 rounded-md ${SEVERITY_STYLES[risk.severity].split(" ")[0]}`}>
                    {RISK_ICONS[risk.icon]}
                  </div>
                  <Badge variant="outline" className={`${SEVERITY_STYLES[risk.severity]} text-[10px] font-bold uppercase tracking-wider px-2 shadow-sm`}>
                    {risk.severity}
                  </Badge>
                </div>
                <p className="text-xs font-bold text-foreground mb-1">{risk.name}</p>
                <div className="flex items-center gap-1.5 text-[11px] tabular-nums tracking-tight">
                  <span className="font-medium text-muted-foreground">{formatVal(risk.currentValue)}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className={`font-bold ${risk.severity === "critical" || risk.severity === "high" ? "text-destructive" : "text-foreground"}`}>
                    {formatVal(risk.simulatedValue)}
                  </span>
                </div>
                <p className={`text-[10px] font-black tabular-nums tracking-tight mt-1 ${risk.delta > 0 ? "text-destructive" : risk.delta < 0 ? "text-success" : "text-muted-foreground"}`}>
                  {formatDelta()}
                </p>
              </div>
            );
          })}
        </div>

        <div className="p-3 bg-muted/30 rounded-lg border border-border/50 flex gap-2 items-start">
          <BrainCircuit className="h-4 w-4 shrink-0 text-ai/70 mt-0.5" />
          <p className="text-xs font-medium text-muted-foreground leading-relaxed">{aiInterpretation}</p>
        </div>
      </CardContent>
    </Card>
  );
}
