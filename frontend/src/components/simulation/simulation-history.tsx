"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SimulationHistoryItem } from "@/types/simulation";
import { Eye, Clock } from "lucide-react";

interface SimulationHistoryProps {
  history: SimulationHistoryItem[];
  onView: (item: SimulationHistoryItem) => void;
}

const SEVERITY_STYLES: Record<string, string> = {
  low: "bg-success/10 text-success border-success/20",
  moderate: "bg-warning/10 text-warning border-warning/20",
  high: "bg-warning/20 text-warning border-warning/30",
  critical: "bg-destructive/10 text-destructive border-destructive/20",
};

export function SimulationHistory({ history, onView }: SimulationHistoryProps) {
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
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-lg font-bold">Recent Simulations</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No simulation history yet.</p>
        ) : (
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto no-scrollbar">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-2 pr-3 font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Scenario</th>
                  <th className="text-left py-2 px-3 font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Date</th>
                  <th className="text-left py-2 px-3 font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Key Change</th>
                  <th className="text-center py-2 px-3 font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Risk</th>
                  <th className="text-left py-2 px-3 font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Result</th>
                  <th className="text-right py-2 pl-3 font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Action</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 pr-3 font-semibold text-foreground">{item.scenario}</td>
                    <td className="py-2.5 px-3 text-muted-foreground font-medium">{formatDate(item.date)}</td>
                    <td className="py-2.5 px-3 font-medium text-foreground">{item.keyChange}</td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant="outline" className={`${SEVERITY_STYLES[item.riskLevel]} text-[10px] font-bold uppercase`}>
                        {item.riskLevel}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-muted-foreground">{item.resultSummary}</td>
                    <td className="py-2.5 pl-3 text-right">
                      <Button size="sm" variant="outline" className="h-7 text-[10px] px-2 hover:text-ai hover:border-ai/30" onClick={() => onView(item)}>
                        <Eye className="h-3 w-3 mr-1.5" /> View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
