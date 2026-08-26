"use client";

import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SystemAlert } from "@/types/alert";
import { Zap, CheckCircle2, Navigation, Clock } from "lucide-react";
import Link from "next/link";

interface AlertDetailsSheetProps {
  alert: SystemAlert | null;
  isOpen: boolean;
  onClose: () => void;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive border-destructive/20",
  high: "bg-warning/20 text-warning border-warning/30",
  medium: "bg-primary/10 text-primary border-primary/20",
  low: "bg-muted text-muted-foreground border-border",
};

const STATUS_STYLES: Record<string, string> = {
  new: "bg-destructive text-white border-transparent",
  acknowledged: "bg-warning text-white border-transparent",
  in_progress: "bg-primary text-white border-transparent",
  resolved: "bg-success text-white border-transparent",
};

export function AlertDetailsSheet({ alert, isOpen, onClose, onAcknowledge, onResolve }: AlertDetailsSheetProps) {
  if (!alert) return null;

  const formattedType = alert.type.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  const scope = new URLSearchParams();
  if (alert.warehouseId) scope.set("dc", alert.warehouseId);
  if (alert.sku) scope.set("sku", alert.sku);
  const recommendationHref = scope.size > 0 ? `/recommendations?${scope}` : "/recommendations";
  
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto no-scrollbar bg-background p-0 border-l border-border/50">
        <div className="p-6">
          <SheetHeader className="text-left mb-6 pb-6 border-b border-border/50">
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="outline" className={`${SEVERITY_STYLES[alert.severity]} text-[10px] font-bold uppercase px-2 shadow-sm`}>
                {alert.severity}
              </Badge>
              <Badge variant="outline" className={`${STATUS_STYLES[alert.status]} text-[10px] font-bold capitalize shadow-sm`}>
                {alert.status.replace("_", " ")}
              </Badge>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">{formattedType}</span>
            </div>

            <h2 className="text-2xl font-black text-foreground leading-tight mb-4">
              {alert.title}
            </h2>

            <div className="flex flex-col gap-3">
              {alert.sku && (
                <div className="bg-muted/10 p-2.5 rounded-lg border border-border/50 flex flex-col">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Affected SKU</span>
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-sm text-foreground">{alert.sku}</span>
                    <span className="text-xs text-muted-foreground">{alert.product}</span>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/10 p-2.5 rounded-lg border border-border/50">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Location</span>
                  <p className="font-bold text-xs text-foreground">{alert.location}</p>
                </div>
                <div className="bg-muted/10 p-2.5 rounded-lg border border-border/50">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Detected</span>
                  <p className="font-bold text-xs text-foreground flex items-center gap-1.5"><Clock className="h-3 w-3 opacity-60" /> {formatTime(alert.detectedAt)}</p>
                </div>
              </div>
            </div>
          </SheetHeader>

          <div className="space-y-6">
            {/* Why this triggered */}
            <section>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Why This Alert Triggered</h3>
              <p className="text-xs text-foreground font-medium leading-relaxed mb-3">
                {alert.explanation}
              </p>
              
              <div className="bg-muted/10 border border-border/50 rounded-xl p-3 grid grid-cols-2 gap-3">
                {alert.metrics.map((metric, idx) => (
                  <div key={idx}>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{metric.label}</p>
                    <p className="text-sm font-bold tabular-nums tracking-tight text-foreground">{metric.value}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Business Impact */}
            <section>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Business Impact</h3>
              <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-xl">
                <p className="text-sm font-black text-destructive">{alert.businessImpact}</p>
              </div>
            </section>

            {/* Recommended Response */}
            <section className="mb-6">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5"><Zap className="h-3 w-3 text-ai" /> AI Recommendation</h3>
              <div className="p-4 bg-ai/10 border border-ai/30 rounded-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-ai" />
                <p className="text-base font-bold text-foreground">{alert.recommendedAction}</p>
              </div>
            </section>

            {/* Timeline */}
            <section className="mb-10">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Alert Timeline</h3>
              <div className="relative pl-4 space-y-4 before:absolute before:inset-y-1.5 before:left-[5px] before:w-px before:bg-border/60">
                {alert.timeline.map((event, idx) => (
                  <div key={idx} className="relative">
                    <div className="absolute -left-[19px] top-1.5 h-2 w-2 rounded-full border-2 border-background bg-muted-foreground/60" />
                    <p className="text-[9px] font-bold tabular-nums text-muted-foreground mb-0.5 uppercase tracking-widest">{formatTime(event.time)}</p>
                    <p className="text-xs font-semibold text-foreground/90">{event.description}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Actions (Pinned to bottom or at least visually distinct at end) */}
            <div className="pt-6 border-t border-border/50 flex flex-col gap-2.5 pb-6">
              {alert.status !== "resolved" && (
                <Button className="w-full h-10 text-xs font-bold bg-success hover:bg-success/90 text-success-foreground" onClick={() => { onResolve(alert.id); onClose(); }}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Resolve Alert
                </Button>
              )}
              {alert.status === "new" && (
                <Button variant="outline" className="w-full h-10 text-xs font-bold border-border/60 bg-muted/20 hover:bg-muted/50" onClick={() => { onAcknowledge(alert.id); onClose(); }}>
                  Acknowledge Alert
                </Button>
              )}
              {/*
                Carries the SKU and DC through. A bare `/recommendations` dropped the
                reader on an unfiltered list and left them to find, by hand, the row
                they had just been looking at.
              */}
              <Link href={recommendationHref} passHref className="w-full">
                <Button variant="ghost" className="w-full h-10 text-xs font-bold text-muted-foreground hover:text-foreground" onClick={onClose}>
                  <Navigation className="h-3.5 w-3.5 mr-2 opacity-70" />
                  View Full Recommendation Context
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
