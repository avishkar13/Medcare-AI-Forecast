"use client";

import { ExpiryBatch } from "@/types/expiry";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Navigation, ArrowRightLeft, Star, Clock } from "lucide-react";
import Link from "next/link";

interface BatchDetailsSheetProps {
  batch: ExpiryBatch | null;
  isOpen: boolean;
  onClose: () => void;
  onPrioritize: (id: string) => void;
}

export function BatchDetailsSheet({ batch, isOpen, onClose, onPrioritize }: BatchDetailsSheetProps) {
  if (!batch) return null;

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "critical": return "border-destructive text-destructive bg-destructive/10";
      case "high": return "border-warning text-warning bg-warning/10";
      case "medium": return "border-muted-foreground text-muted-foreground bg-muted";
      case "low": return "border-success text-success bg-success/10";
      default: return "border-border text-foreground";
    }
  };

  const formatCurrency = (val: number) => "$" + val.toLocaleString();

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto no-scrollbar bg-background p-0 border-l border-border/50">
        <div className="p-6">
          <SheetHeader className="text-left mb-6 pb-6 border-b border-border/50">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="secondary" className={`${getRiskColor(batch.riskLevel)} text-[10px] font-black uppercase tracking-wider px-2 shadow-none`}>
                {batch.riskLevel} Risk
              </Badge>
              <Badge variant="outline" className="border-border/50 bg-muted/5 text-muted-foreground text-[10px] font-bold capitalize shadow-none">
                {batch.status}
              </Badge>
            </div>

            <h2 className="text-xl font-black text-foreground leading-tight mb-4">
              {batch.productName}
            </h2>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/5">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Batch Number</span>
                  <span className="font-bold text-sm text-foreground">{batch.batchNumber}</span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">SKU</span>
                  <span className="text-sm font-medium text-muted-foreground">{batch.sku}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-lg border border-border/50 bg-muted/5 flex flex-col justify-between">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Expiry</span>
                  <p className={`font-black text-sm flex items-center gap-1.5 ${batch.daysRemaining <= 30 ? 'text-destructive' : batch.daysRemaining <= 60 ? 'text-warning' : 'text-foreground'}`}>
                    {batch.daysRemaining} days left
                  </p>
                  <p className="text-[10px] font-medium text-muted-foreground mt-1">
                    {new Date(batch.expiryDate).toLocaleDateString()}
                  </p>
                </div>
                
                <div className="p-3 rounded-lg border border-border/50 bg-muted/5 flex flex-col justify-between">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Quantity & Value</span>
                  <p className="font-black text-sm text-foreground">{batch.quantity.toLocaleString()} units</p>
                  <p className="text-[10px] font-bold text-muted-foreground mt-1">{formatCurrency(batch.inventoryValue)} total</p>
                </div>
              </div>
            </div>
          </SheetHeader>

          <div className="space-y-6">
            
            {/* Demand Coverage */}
            <section>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Demand Coverage</h3>
              <div className="bg-background border border-border/50 rounded-lg p-3">
                <div className="flex justify-between items-end mb-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground font-medium">Forecast Demand</span>
                    <span className="text-sm font-bold">{batch.forecastDemand.toLocaleString()} units</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[10px] text-muted-foreground font-medium">Expected Remaining</span>
                    <span className={`text-sm font-bold ${batch.projectedWasteUnits > 0 ? 'text-warning' : 'text-success'}`}>{batch.projectedWasteUnits.toLocaleString()} units</span>
                  </div>
                </div>
                <div className="w-full bg-muted/20 h-1.5 rounded-full overflow-hidden mt-1 relative">
                  <div className={`absolute left-0 top-0 h-full ${batch.demandCoverage >= 100 ? 'bg-success' : 'bg-warning'} transition-all`} style={{ width: `${Math.min(100, batch.demandCoverage)}%` }} />
                </div>
                <p className="text-[9px] font-bold text-muted-foreground text-right mt-1">{batch.demandCoverage}% Covered</p>
              </div>
            </section>

            {/* Expiry Risk */}
            <section>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Expiry Risk</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-background border border-border/50 rounded-lg p-3">
                  <span className="text-[10px] text-muted-foreground font-medium mb-1 block">Waste Probability</span>
                  <span className="text-sm font-bold">{batch.wasteSharePercent}%</span>
                </div>
                <div className="bg-background border border-border/50 rounded-lg p-3">
                  <span className="text-[10px] text-muted-foreground font-medium mb-1 block">Potential Waste Value</span>
                  <span className="text-sm font-bold text-destructive">{formatCurrency(batch.wasteValue)}</span>
                </div>
              </div>
            </section>

            {/* AI Recommendation */}
            <section className="mb-6">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-ai fill-ai/20" /> AI Recommendation</h3>
              <div className="p-4 bg-ai/5 border border-ai/20 rounded-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-ai" />
                <p className="text-sm font-medium text-foreground leading-relaxed">
                  {batch.status === "prioritized" 
                    ? <><span className="font-bold">Prioritize this batch for fulfillment</span> over newer inventory. If demand remains unchanged, approximately <span className="font-bold text-warning">{batch.projectedWasteUnits.toLocaleString()} units</span> may remain unused before expiry.</>
                    : batch.status === "transfer"
                    ? <><span className="font-bold">Transfer excess inventory to another DC.</span> Current demand at {batch.location} is insufficient to consume this batch before expiry.</>
                    : <><span className="font-bold">Monitor consumption closely.</span> Demand coverage is currently tracking at {batch.demandCoverage}%, meaning most of the batch should be consumed.</>}
                </p>
              </div>
            </section>

            {/* Batch Timeline */}
            <section className="mb-10">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Batch Lifecycle</h3>
              <div className="relative pl-4 space-y-4 before:absolute before:inset-y-1.5 before:left-[5px] before:w-px before:bg-border/60">
                <div className="relative">
                  <div className="absolute -left-[19px] top-1.5 h-2 w-2 rounded-full border-2 border-background bg-muted-foreground/40" />
                  <p className="text-[9px] font-bold text-muted-foreground mb-0.5 uppercase tracking-widest">Received</p>
                  <p className="text-[10px] font-medium text-foreground/70">Arrived at origin facility</p>
                </div>
                <div className="relative">
                  <div className="absolute -left-[19px] top-1.5 h-2 w-2 rounded-full border-2 border-background bg-muted-foreground/40" />
                  <p className="text-[9px] font-bold text-muted-foreground mb-0.5 uppercase tracking-widest">Stored</p>
                  <p className="text-[10px] font-medium text-foreground/70">Placed in {batch.location}</p>
                </div>
                <div className="relative">
                  <div className="absolute -left-[19px] top-1.5 h-2 w-2 rounded-full border-2 border-background bg-primary/60" />
                  <p className="text-[9px] font-bold text-primary mb-0.5 uppercase tracking-widest">Current Inventory</p>
                  <p className="text-[10px] font-bold text-foreground">{batch.daysRemaining} days remaining</p>
                </div>
                <div className="relative">
                  <div className="absolute -left-[19px] top-1.5 h-2 w-2 rounded-full border-2 border-background bg-destructive" />
                  <p className="text-[9px] font-bold text-destructive mb-0.5 uppercase tracking-widest">Risk Detected</p>
                  <p className="text-[10px] font-bold text-foreground">{batch.wasteSharePercent}% waste probability flagged</p>
                </div>
              </div>
            </section>

            {/* Actions */}
            <div className="pt-6 border-t border-border/50 flex flex-col gap-2.5 pb-8">
              <Button 
                className={`w-full h-11 text-sm font-bold shadow-sm transition-all hover:scale-[1.01] ${batch.riskLevel === 'critical' ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : 'bg-primary hover:bg-primary/90 text-primary-foreground'}`}
                onClick={() => { onPrioritize(batch.id); onClose(); }}
              >
                {batch.status === "prioritized" ? (
                  <><Star className="h-4 w-4 mr-2" /> Execute FEFO Priority</>
                ) : batch.status === "transfer" ? (
                  <><ArrowRightLeft className="h-4 w-4 mr-2" /> Initiate Transfer</>
                ) : (
                  <><Clock className="h-4 w-4 mr-2" /> Monitor Batch</>
                )}
              </Button>
              <Link href="/recommendations" passHref className="w-full">
                <Button variant="outline" className="w-full h-11 text-sm font-bold bg-background border-border/60 hover:bg-muted/30 transition-all" onClick={onClose}>
                  <Navigation className="h-4 w-4 mr-2 text-muted-foreground" />
                  View Recommendation Details
                </Button>
              </Link>
            </div>

          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
