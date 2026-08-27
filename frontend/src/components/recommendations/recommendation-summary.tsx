"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListChecks, AlertCircle, AlertTriangle, Info, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useRecommendationSummary } from "@/hooks/use-recommendations";
import { QueryError } from "@/components/ui/query-state";

export function RecommendationSummary() {
  const { data, isPending, isError } = useRecommendationSummary();

  // counted over the whole run by the api, not over whatever page is on screen
  const priority = (level: string) =>
    data?.byPriority.find((row) => row.priority === level)?.count ?? 0;
  const status = (state: string) =>
    data?.byStatus.find((row) => row.status === state)?.count ?? 0;

  const critical = priority("CRITICAL");
  const high = priority("HIGH");
  const medium = priority("MEDIUM");
  const low = priority("LOW");

  const pending = status("OPEN");
  const executed = status("COMPLETED") + status("ACCEPTED");
  const dismissed = status("REJECTED");

  if (isPending) return null;

  if (isError) return <QueryError label="the recommendation summary" />;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3 border-b border-border/50 bg-muted/10">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-ai" />
          Action Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-5">
        
        <div>
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2.5 border-b border-border/50 pb-1.5">By Priority</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium p-1.5 rounded hover:bg-muted/50 transition-colors">
              <span className="flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 text-destructive" /> Critical
              </span>
              <span className="font-bold text-foreground">{critical}</span>
            </div>
            <div className="flex items-center justify-between text-xs font-medium p-1.5 rounded hover:bg-muted/50 transition-colors">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-warning" /> High
              </span>
              <span className="font-bold text-foreground">{high}</span>
            </div>
            <div className="flex items-center justify-between text-xs font-medium p-1.5 rounded hover:bg-muted/50 transition-colors">
              <span className="flex items-center gap-2">
                <Info className="h-3.5 w-3.5 text-ai" /> Medium
              </span>
              <span className="font-bold text-foreground">{medium}</span>
            </div>
            <div className="flex items-center justify-between text-xs font-medium p-1.5 rounded hover:bg-muted/50 transition-colors">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Info className="h-3.5 w-3.5" /> Low
              </span>
              <span className="font-bold text-foreground">{low}</span>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2.5 border-b border-border/50 pb-1.5">By Status</h4>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-background border border-border/60 rounded-lg shadow-sm">
              <Clock className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-base font-black">{pending}</p>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Pending</p>
            </div>
            <div className="p-2 bg-success/10 border border-success/20 rounded-lg shadow-sm">
              <CheckCircle2 className="h-3.5 w-3.5 mx-auto mb-1 text-success" />
              <p className="text-base font-black text-success-foreground">{executed}</p>
              <p className="text-[9px] font-bold text-success-foreground uppercase tracking-wider">Executed</p>
            </div>
            <div className="p-2 bg-muted/30 border border-border/50 rounded-lg shadow-sm">
              <XCircle className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-base font-black text-muted-foreground">{dismissed}</p>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Dismissed</p>
            </div>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
