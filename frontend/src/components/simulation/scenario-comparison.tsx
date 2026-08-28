"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SavedScenario } from "@/types/simulation";
import { Plus, Play, Save } from "lucide-react";
import { useFormatters } from "@/hooks/use-formatters";

interface ScenarioComparisonProps {
  scenarios: SavedScenario[];
  onApply: (scenario: SavedScenario) => void;
  onSaveCurrent: () => void;
}

const SEVERITY_STYLES: Record<string, string> = {
  low: "bg-success/10 text-success border-success/20",
  moderate: "bg-warning/10 text-warning border-warning/20",
  high: "bg-warning/20 text-warning border-warning/30",
  critical: "bg-destructive/10 text-destructive border-destructive/20",
};

export function ScenarioComparison({ scenarios, onApply, onSaveCurrent }: ScenarioComparisonProps) {
  const { formatCompactCurrency } = useFormatters();
  const compareScenarios = scenarios.slice(0, 3);
  const metricLabels = ["Stockout Risk", "Supply Chain Cost", "Service Level", "Expiry Exposure"];

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { 
      day: "2-digit", 
      month: "short", 
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <Card className="rounded-xl border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold">Compare Scenarios</CardTitle>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">Side-by-side comparison of saved scenarios.</p>
          </div>
          <Button variant="outline" size="sm" onClick={onSaveCurrent} className="text-xs">
            <Save className="h-3.5 w-3.5 mr-1.5" />
            Save Current
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {compareScenarios.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-border/60 rounded-xl">
            <Plus className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-xs font-medium text-muted-foreground">No saved scenarios yet.</p>
            <p className="text-[10px] text-muted-foreground mt-1">Run a simulation and save it to compare.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-2 pr-4 font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Metric</th>
                  {compareScenarios.map((s) => (
                    <th key={s.id} className="text-center py-2 px-3 font-bold text-foreground text-[10px] uppercase tracking-wider">
                      <div>{s.name}</div>
                      <div className="text-[8px] text-muted-foreground mt-0.5 font-medium tracking-normal lowercase">{formatDate(s.createdAt)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/30">
                  <td className="py-2 pr-4 font-medium text-muted-foreground">Risk Level</td>
                  {compareScenarios.map((s) => (
                    <td key={s.id} className="text-center py-2 px-3">
                      <Badge variant="outline" className={`${SEVERITY_STYLES[s.riskLevel]} text-[10px] font-bold uppercase`}>
                        {s.riskLevel}
                      </Badge>
                    </td>
                  ))}
                </tr>
                {metricLabels.map((label, i) => (
                  <tr key={label} className="border-b border-border/30">
                    <td className="py-2 pr-4 font-medium text-muted-foreground">{label}</td>
                    {compareScenarios.map((s) => {
                      const metric = s.metrics[i === 0 ? 0 : i === 1 ? 2 : i === 2 ? 3 : 4];
                      if (!metric) return <td key={s.id} className="text-center py-2 px-3">—</td>;
                      const val = metric.format === "currency"
                        ? formatCompactCurrency(metric.simulatedValue)
                        : `${metric.simulatedValue}%`;
                      return (
                        <td key={s.id} className="text-center py-2 px-3">
                          <span className={`font-bold tabular-nums ${
                            metric.direction === "negative" ? "text-destructive" :
                            metric.direction === "positive" ? "text-success" : "text-foreground"
                          }`}>
                            {val}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr>
                  <td className="py-2 pr-4" />
                  {compareScenarios.map((s) => (
                    <td key={s.id} className="text-center py-2 px-3">
                      <Button size="sm" className="text-[10px] h-7 w-full max-w-[100px] bg-ai/10 text-ai hover:bg-ai hover:text-white" onClick={() => onApply(s)}>
                        <Play className="h-3 w-3 mr-1.5" /> Apply
                      </Button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
