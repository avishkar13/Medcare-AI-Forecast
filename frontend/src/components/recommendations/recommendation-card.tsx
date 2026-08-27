"use client";

import { Card, CardContent } from "@/components/ui/card";
import { RecommendationItem } from "@/types/recommendation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, MapPin, Zap, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useState } from "react";
import { RecommendationDrawer } from "./recommendation-drawer";
import { useAuthStore } from "@/store/auth.store";

interface RecommendationCardProps {
  recommendation: RecommendationItem;
  onExecute: (id: string) => void;
  onDismiss: (id: string) => void;
}

export function RecommendationCard({ recommendation, onExecute, onDismiss }: RecommendationCardProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { hasPermission } = useAuthStore();

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "Critical": return "bg-destructive/10 text-destructive border-destructive/20";
      case "High": return "bg-warning/20 text-warning border-warning/30";
      case "Medium": return "bg-ai/10 text-ai border-ai/20";
      case "Low": return "bg-muted text-muted-foreground border-border";
      default: return "";
    }
  };

  const getStatusOverlay = () => {
    if (recommendation.status === "Executed") {
      return (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-xl transition-all duration-300">
          <Badge className="bg-success text-success-foreground px-4 py-1.5 text-sm shadow-sm border border-success/30">Action Executed</Badge>
        </div>
      );
    }
    if (recommendation.status === "Dismissed") {
      return (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-xl transition-all duration-300">
          <Badge variant="outline" className="bg-background px-4 py-1.5 text-sm text-muted-foreground shadow-sm">Action Dismissed</Badge>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <Card className="relative rounded-xl overflow-hidden shadow-sm border-border/40 hover:border-border/80 transition-all duration-200 hover:shadow-md group">
        {getStatusOverlay()}
        
        {/* Left priority accent line */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-border/50 transition-colors group-hover:bg-border/80">
          {recommendation.priority === "Critical" && <div className="h-full w-full bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]" />}
          {recommendation.priority === "High" && <div className="h-full w-full bg-warning" />}
          {recommendation.priority === "Medium" && <div className="h-full w-full bg-ai" />}
        </div>
        
        <CardContent className="p-3.5 pl-4 sm:p-4 sm:pl-5 flex flex-col md:flex-row md:items-start gap-3 sm:gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <Badge variant="outline" className={`${getPriorityColor(recommendation.priority)} px-2 py-0.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wider`}>
                {recommendation.priority} Priority
              </Badge>
              <div className="flex items-center gap-1 text-[11px] sm:text-xs font-medium text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded border border-border/50">
                <Zap className="h-3 w-3 text-ai" /> {recommendation.confidence}% Conf.
              </div>
            </div>
            
            <h3 className="text-base sm:text-lg font-bold text-foreground mb-1 tracking-tight">{recommendation.title}</h3>
            
            <p className="text-xs sm:text-sm text-muted-foreground mb-3 max-w-2xl leading-relaxed">
              {recommendation.reason}
            </p>
            
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-3 p-2 sm:p-2.5 bg-muted/20 rounded-lg border border-border/40">
              <div className="flex items-center gap-1.5 text-xs sm:text-sm text-foreground font-medium">
                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{recommendation.sku}</span>
              </div>
              
              <div className="flex items-center gap-1.5 text-xs sm:text-sm text-foreground font-medium">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                {recommendation.fromLocation ? (
                  <span>{recommendation.fromLocation} <span className="text-muted-foreground mx-1">→</span> {recommendation.toLocation}</span>
                ) : (
                  <span>{recommendation.location}</span>
                )}
              </div>
              
              <div className="flex items-center gap-1 text-xs font-semibold text-success bg-success/10 px-2 py-0.5 rounded-md">
                <TrendingDown className="h-3 w-3" />
                {recommendation.expectedImpact}
              </div>
            </div>

            <div className="flex items-center gap-3 text-[11px] sm:text-xs font-medium text-muted-foreground">
              <span className="uppercase tracking-wider font-semibold text-foreground/70">Signals:</span>
              <div className="flex gap-3">
                {recommendation.signals.map((s, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {s.label}
                    {s.direction === 'up' ? <TrendingUp className="h-3 w-3 text-destructive" /> : 
                     s.direction === 'down' ? <TrendingDown className="h-3 w-3 text-success" /> : 
                     <Minus className="h-3 w-3" />}
                  </span>
                ))}
              </div>
            </div>
          </div>
          
          <div className="flex flex-row md:flex-col items-center md:items-stretch gap-1.5 shrink-0 md:w-[130px] pt-1">
            <Button size="sm" variant="outline" className="w-full bg-background border-border/80 hover:bg-muted text-xs h-8" onClick={() => setIsDrawerOpen(true)}>
              View Details
            </Button>
            {recommendation.status === "Pending" && (
              <>
                {hasPermission("recommendations:execute") && (
                  <Button size="sm" className="w-full bg-ai hover:bg-ai/90 text-primary-foreground font-semibold text-xs h-8" onClick={() => onExecute(recommendation.id)}>
                    Execute
                  </Button>
                )}
                {hasPermission("recommendations:dismiss") && (
                  <Button size="sm" variant="ghost" className="w-full text-muted-foreground hover:text-foreground hover:bg-muted/50 text-xs h-8" onClick={() => onDismiss(recommendation.id)}>
                    Dismiss
                  </Button>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <RecommendationDrawer 
        isOpen={isDrawerOpen} 
        onOpenChange={setIsDrawerOpen}
        recommendation={recommendation}
        onExecute={() => { onExecute(recommendation.id); setIsDrawerOpen(false); }}
        onDismiss={() => { onDismiss(recommendation.id); setIsDrawerOpen(false); }}
      />
    </>
  );
}
