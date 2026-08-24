"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecommendationIntelligence } from "@/types/recommendation";
import { BrainCircuit, Activity, Package, Clock, AlertTriangle } from "lucide-react";

export function RecommendationIntelligenceCard({ data }: { data: RecommendationIntelligence }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3 border-b border-border/50 bg-muted/10">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-ai" />
          AI Decision Intelligence
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-5">
        
        <div className="flex items-center justify-between bg-gradient-to-r from-ai/10 to-background p-3.5 rounded-xl border border-ai/20 shadow-sm">
          <div>
            <p className="text-[10px] font-bold text-ai uppercase tracking-widest mb-0.5">Model Confidence</p>
            <p className="text-xs font-medium text-muted-foreground">Ensemble prediction</p>
          </div>
          <div className="text-3xl font-black text-ai flex items-baseline gap-1 tracking-tight">
            {data.modelConfidence}<span className="text-sm font-bold opacity-80">%</span>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 border-b border-border/50 pb-1.5">Signal Weighting</h4>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="p-2.5 bg-background border border-border/60 rounded-lg shadow-sm hover:border-ai/30 transition-colors">
              <div className="flex items-center justify-between mb-1.5">
                <Activity className="h-3.5 w-3.5 text-ai" />
                <span className="text-xs font-black">{data.signals.demandForecast}%</span>
              </div>
              <p className="text-[11px] font-semibold text-muted-foreground">Demand Forecast</p>
            </div>
            
            <div className="p-2.5 bg-background border border-border/60 rounded-lg shadow-sm hover:border-ai/30 transition-colors">
              <div className="flex items-center justify-between mb-1.5">
                <Package className="h-3.5 w-3.5 text-ai" />
                <span className="text-xs font-black">{data.signals.inventoryPosition}%</span>
              </div>
              <p className="text-[11px] font-semibold text-muted-foreground">Inventory Position</p>
            </div>
            
            <div className="p-2.5 bg-background border border-border/60 rounded-lg shadow-sm hover:border-ai/30 transition-colors">
              <div className="flex items-center justify-between mb-1.5">
                <Clock className="h-3.5 w-3.5 text-ai" />
                <span className="text-xs font-black">{data.signals.leadTime}%</span>
              </div>
              <p className="text-[11px] font-semibold text-muted-foreground">Lead Time</p>
            </div>
            
            <div className="p-2.5 bg-background border border-border/60 rounded-lg shadow-sm hover:border-ai/30 transition-colors">
              <div className="flex items-center justify-between mb-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-ai" />
                <span className="text-xs font-black">{data.signals.expiryRisk}%</span>
              </div>
              <p className="text-[11px] font-semibold text-muted-foreground">Expiry Risk</p>
            </div>
          </div>
        </div>

        <div className="p-3 bg-muted/40 rounded-lg border border-border/50 text-xs font-medium text-muted-foreground leading-relaxed flex gap-2 items-start">
          <BrainCircuit className="h-4 w-4 shrink-0 text-ai/70 mt-0.5" />
          <p>{data.explanation}</p>
        </div>
      </CardContent>
    </Card>
  );
}
