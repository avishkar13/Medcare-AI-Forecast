"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { RecommendationItem } from "@/types/recommendation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/auth.store";
import { ShieldCheck, Package, TrendingUp, TrendingDown, Minus, Clock, MapPin, Zap } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface RecommendationDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  recommendation: RecommendationItem | null;
  onExecute: () => void;
  onDismiss: () => void;
}

export function RecommendationDrawer({ isOpen, onOpenChange, recommendation, onExecute, onDismiss }: RecommendationDrawerProps) {
  const { hasPermission } = useAuthStore();

  if (!recommendation) return null;

  const isExecuted = recommendation.status === "Executed";
  // const isDismissed = recommendation.status === "Dismissed";

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto p-5">
        <SheetHeader className="mb-6 border-b border-border/50 pb-5">
          <div className="flex items-center justify-between mb-3">
            <Badge variant="outline" className={`
              ${recommendation.priority === 'Critical' ? 'bg-destructive/10 text-destructive border-destructive/20' : ''}
              ${recommendation.priority === 'High' ? 'bg-warning/20 text-warning border-warning/30' : ''}
              ${recommendation.priority === 'Medium' ? 'bg-ai/10 text-ai border-ai/20' : ''}
              ${recommendation.priority === 'Low' ? 'bg-muted text-muted-foreground' : ''}
              px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider
            `}>
              {recommendation.priority} Priority
            </Badge>
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {formatDistanceToNow(new Date(recommendation.createdAt), { addSuffix: true })}
            </span>
          </div>
          <SheetTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{recommendation.title}</SheetTitle>
          <SheetDescription className="text-sm sm:text-base text-foreground/80 leading-relaxed mt-2">
            {recommendation.reason}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* Expected Impact */}
          <div className="p-4 sm:p-5 bg-gradient-to-br from-success/10 to-background border border-success/30 rounded-xl shadow-sm">
            <h4 className="text-xs font-bold uppercase tracking-wider text-success flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4" />
              Expected Impact
            </h4>
            <p className="text-base font-semibold text-foreground">
              {recommendation.expectedImpact || `$${(recommendation.impactValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 p-4 sm:p-5 bg-muted/20 border border-border/50 rounded-xl">
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground mb-1">Product</p>
              <p className="font-semibold text-sm">{recommendation.productName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{recommendation.sku} • {recommendation.category}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Location</p>
              <p className="font-semibold text-sm flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                {recommendation.location}
              </p>
            </div>
            {recommendation.fromLocation && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">From</p>
                <p className="font-semibold text-sm">{recommendation.fromLocation}</p>
              </div>
            )}
            {recommendation.currentStock !== undefined && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Current Stock</p>
                <p className="font-semibold text-sm">{recommendation.currentStock.toLocaleString()} units</p>
              </div>
            )}
            {recommendation.forecastDemand !== undefined && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Forecast Demand</p>
                <p className="font-semibold text-sm">{recommendation.forecastDemand.toLocaleString()} units</p>
              </div>
            )}
            {recommendation.optimalStock !== undefined && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Optimal Stock</p>
                <p className="font-semibold text-sm">{recommendation.optimalStock.toLocaleString()} units</p>
              </div>
            )}
          </div>

          {/* AI Decision Intelligence */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">AI Reasoning Signals</h4>
            <div className="space-y-2.5">
              {recommendation.signals.map((signal, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 bg-background border border-border/50 rounded-lg shadow-sm">
                  <div className="flex items-center gap-2.5">
                    {signal.type === 'Demand' && <TrendingUp className="h-4 w-4 text-ai" />}
                    {signal.type === 'Inventory' && <Package className="h-4 w-4 text-ai" />}
                    {signal.type === 'LeadTime' && <Clock className="h-4 w-4 text-ai" />}
                    {signal.type === 'Expiry' && <ShieldCheck className="h-4 w-4 text-ai" />}
                    {signal.type === 'Risk' && <ShieldCheck className="h-4 w-4 text-destructive" />}
                    <span className="text-sm font-medium">{signal.label}</span>
                  </div>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold tracking-wide ${
                    signal.direction === 'up' ? 'bg-destructive/10 text-destructive' :
                    signal.direction === 'down' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                  }`}>
                    {signal.direction === 'up' && <TrendingUp className="h-3.5 w-3.5" />}
                    {signal.direction === 'down' && <TrendingDown className="h-3.5 w-3.5" />}
                    {signal.direction === 'flat' && <Minus className="h-3.5 w-3.5" />}
                    {signal.direction.toUpperCase()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Confidence */}
          {recommendation.confidence > 0 && (
            <div className="p-4 sm:p-5 bg-gradient-to-r from-ai/10 to-background border border-ai/20 rounded-xl flex items-center justify-between shadow-sm">
              <span className="text-sm font-bold uppercase tracking-wider text-foreground">AI Confidence Score</span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-ai">{recommendation.confidence}%</span>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-8 pt-6 border-t border-border/50 flex flex-col gap-3">
          {recommendation.status === "Pending" ? (
            <>
              {hasPermission("recommendations:execute") && (
                <Button onClick={onExecute} size="lg" className="w-full bg-ai hover:bg-ai/90 text-primary-foreground font-semibold shadow-md">
                  Execute Action
                </Button>
              )}
              {hasPermission("recommendations:dismiss") && (
                <Button onClick={onDismiss} variant="outline" size="lg" className="w-full font-medium">
                  Dismiss Recommendation
                </Button>
              )}
            </>
          ) : (
            <div className="p-4 text-center rounded-xl border border-border bg-muted/30">
              <p className="text-sm font-medium text-muted-foreground flex items-center justify-center gap-2">
                {isExecuted ? <Zap className="h-4 w-4 text-success" /> : <Minus className="h-4 w-4" />}
                This recommendation was {isExecuted ? 'executed' : 'dismissed'}.
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
