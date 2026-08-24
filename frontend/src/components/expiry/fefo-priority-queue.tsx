"use client";

import { ExpiryBatch } from "@/types/expiry";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Star } from "lucide-react";

interface FEFOPriorityQueueProps {
  batches: ExpiryBatch[];
}

export function FEFOPriorityQueue({ batches }: FEFOPriorityQueueProps) {
  // Sort by highest waste risk & lowest days remaining
  const priorityBatches = [...batches]
    .sort((a, b) => {
      const aRisk = a.wasteValue;
      const bRisk = b.wasteValue;
      return bRisk - aRisk; // descending risk
    })
    .slice(0, 5);

  const getAction = (batch: ExpiryBatch) => {
    if (batch.status === "prioritized") return "Prioritize Fulfillment";
    if (batch.status === "transfer") return "Transfer to Demand Node";
    if (batch.status === "monitor") return "Accelerate Consumption";
    return "Review Repositioning";
  };

  return (
    <Card className="border-border/60 shadow-sm mb-6 bg-background">
      <CardHeader className="pb-4 border-b border-border/50">
        <CardTitle className="text-sm font-bold flex flex-col gap-1">
          <span className="text-base flex items-center gap-2">
            <Star className="h-4 w-4 text-warning fill-warning" />
            FEFO Priority Queue
          </span>
          <span className="text-[10px] font-medium text-muted-foreground normal-case">
            Batches that should be consumed or repositioned first.
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex flex-col divide-y divide-border/50">
          {priorityBatches.map((batch, index) => {
            const getRankStyles = (idx: number) => {
              if (idx === 0) return "bg-destructive/5 border-l-4 border-destructive hover:bg-destructive/10";
              if (idx === 1) return "bg-warning/5 border-l-4 border-warning hover:bg-warning/10";
              return "border-l-4 border-transparent hover:bg-muted/5";
            };

            const getRankBadgeStyles = (idx: number) => {
              if (idx === 0) return "bg-destructive text-destructive-foreground border-destructive shadow-sm shadow-destructive/20";
              if (idx === 1) return "bg-warning text-warning-foreground border-warning shadow-sm shadow-warning/20";
              return "bg-muted/30 text-muted-foreground border-border";
            };

            return (
            <div key={batch.id} className={`flex flex-col md:flex-row gap-4 p-4 items-start md:items-center transition-all group cursor-pointer ${getRankStyles(index)}`}>
              
              {/* Rank */}
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-black text-sm border ${getRankBadgeStyles(index)}`}>
                #{index + 1}
              </div>

              {/* Info */}
              <div className="flex-1 flex flex-col gap-3 w-full">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex flex-col">
                    <span className="font-bold text-sm text-foreground">{batch.productName}</span>
                    <span className="text-[10px] font-medium text-muted-foreground">{batch.location} • {batch.batchNumber}</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="font-bold text-xs text-destructive">{batch.daysRemaining} days remaining</span>
                    <span className="text-[10px] font-medium text-muted-foreground">Expires {new Date(batch.expiryDate).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 mt-1">
                  <div className="flex flex-col">
                    <span className="font-bold text-xs text-foreground">{batch.quantity.toLocaleString()} units</span>
                    <span className="text-[10px] font-medium text-muted-foreground">Coverage: {batch.demandCoverage}%</span>
                  </div>
                  <Button size="sm" variant="secondary" className="w-full sm:w-auto h-8 px-3 text-[11px] font-bold bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer shadow-sm border border-primary/20 hover:border-primary">
                    {getAction(batch)}
                    <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                </div>
              </div>
            </div>
            );
          })}
          
          {priorityBatches.length === 0 && (
            <div className="p-8 text-center">
              <span className="text-sm font-bold text-muted-foreground">No priority batches found.</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
