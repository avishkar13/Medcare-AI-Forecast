"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useState } from "react";
import { toast } from "sonner";
import { useRecommendationAction, useRecommendations } from "@/hooks/use-recommendations";
import { Briefcase, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { QueryError } from "@/components/ui/query-state";

export function ExecutiveDecisionPanel() {
  const { data, isPending, isError } = useRecommendations({ pageSize: 3 });
  // The most prominent button on the dashboard had no handler at all.
  const { execute } = useRecommendationAction();
  const [actingId, setActingId] = useState<string | null>(null);

  const act = (id: string) => {
    setActingId(id);
    execute.mutate(id, {
      onSuccess: () =>
        toast.success("Decision executed", {
          description: "A restock request has been raised where the action called for one.",
        }),
      onError: (error: Error) =>
        toast.error("Could not execute the decision", { description: error.message }),
      onSettled: () => setActingId(null),
    });
  };

  const topDecisions = (data?.data ?? []).map((rec) => ({
    id: rec.id,
    itemId: rec.sku,
    action: rec.actionType ?? rec.type,
    priority: rec.priority.toLowerCase(),
    reason: rec.message,
    expectedImpact: rec.expectedImpact ?? "",
    suggestedQuantity: rec.quantity ?? 0,
    destinationDc: rec.warehouseCode,
  }));

  // Checked first and on its own: this used to sit *inside* the branch below, so a
  // failed request rendered "No decisions pending" - a reassuring sentence about an
  // empty queue, over an error.
  if (isError) return <QueryError label="the decision summary" />;

  if (isPending || topDecisions.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          {isPending ? "Loading…" : "No decisions pending. Run the planner to generate them."}
        </CardContent>
      </Card>
    );
  }

  const getCardStyles = (priority: string) => {
    switch(priority) {
      case "critical": return "border-destructive/30 bg-destructive/5 hover:border-destructive/50 shadow-sm shadow-destructive/10";
      case "high": return "border-warning/30 bg-warning/5 hover:border-warning/50";
      case "medium": return "border-primary/20 bg-primary/5 hover:border-primary/40";
      default: return "border-border/50 bg-background";
    }
  };
  
  const getBadgeStyles = (priority: string) => {
    switch(priority) {
      case "critical": return "bg-destructive text-[#FFFFFF] hover:bg-destructive";
      case "high": return "bg-warning text-[#FFFFFF] hover:bg-warning";
      case "medium": return "bg-primary/20 text-primary hover:bg-primary/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Card className="col-span-full border-2 border-primary/20 bg-muted/10 shadow-lg mt-4">
      <CardHeader className="pb-5 border-b border-border/50 bg-background/50">
        <CardTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
          <Briefcase className="h-5 w-5 text-primary" />
          Today&apos;s Supply Chain Decisions
        </CardTitle>
        <CardDescription className="text-sm font-medium">Top AI-generated recommendations requiring immediate executive approval</CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {topDecisions.map((decision) => (
            <div 
              key={decision.id} 
              className={`p-5 rounded-xl border transition-all duration-200 flex flex-col h-full ${getCardStyles(decision.priority)}`}
            >
              <div className="flex items-center justify-between mb-3">
                <Badge className={`capitalize border-transparent ${getBadgeStyles(decision.priority)}`}>
                  {decision.priority} Priority
                </Badge>
                <span className="text-xs font-mono font-medium text-muted-foreground bg-background px-2 py-1 rounded">
                  {decision.itemId}
                </span>
              </div>
              
              <div className="flex flex-col gap-2 mb-4">
                <h3 className="font-bold text-foreground text-lg leading-tight flex items-center gap-1.5">
                  {decision.action === "order" ? "Replenish" : decision.action === "transfer" ? "Transfer" : "Prioritize"} 
                  <span className="text-primary">{decision.suggestedQuantity.toLocaleString()}</span> units
                </h3>
                <p className="text-sm font-medium text-muted-foreground line-clamp-2 leading-relaxed">
                  {decision.reason}
                </p>
              </div>
              
              <div className="mt-auto flex flex-col gap-4">
                <div className="bg-success/15 border border-success/20 p-3 rounded-lg flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-success">Expected Business Impact</span>
                  <span className="text-sm font-bold text-success/90">{decision.expectedImpact}</span>
                </div>
                
                <button
                  disabled={actingId === decision.id}
                  onClick={() => act(decision.id)}
                  className={`w-full group flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer disabled:opacity-60 ${
                  decision.priority === 'critical' ? 'bg-destructive text-[#FFFFFF] hover:bg-destructive/90 shadow-md shadow-destructive/20' : 
                  decision.priority === 'high' ? 'bg-warning text-[#FFFFFF] hover:bg-warning/90 shadow-md shadow-warning/20' : 
                  'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20'
                }`}>
                  {actingId === decision.id ? "Working…" : "Approve & Execute"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
