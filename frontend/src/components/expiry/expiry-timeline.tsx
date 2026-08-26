"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExpiryTimelineGroup } from "@/types/expiry";
import { CalendarClock } from "lucide-react";
import { useExpiryTimeline } from "@/hooks/use-expiry";

// the api buckets by calendar month, so the nodes are months rather than day windows
const monthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

export function ExpiryTimeline() {
  const { data, isPending } = useExpiryTimeline();

  const timelineData: ExpiryTimelineGroup[] = (data ?? []).slice(0, 5).map((point) => ({
    label: monthLabel(point.month),
    batches: point.batchCount,
    value: point.valueExpiring,
  }));

  const formatCurrency = (val: number) => {
    return "$" + (val / 1000).toFixed(1) + "K";
  };

  const getUrgencyColor = (idx: number) => {
    if (idx === 0) return "bg-destructive border-destructive text-destructive-foreground";
    if (idx === 1) return "bg-warning border-warning text-warning-foreground";
    if (idx === 2) return "bg-warning/80 border-warning/80 text-warning-foreground";
    return "bg-primary border-primary text-primary-foreground";
  };

  if (isPending) return null;

  return (
    <Card className="border-border/60 shadow-sm mb-6 bg-background">
      <CardHeader className="pb-4 border-b border-border/50">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          Upcoming Expiry Timeline
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-6">
        <div className="relative">
          {/* Connecting Line */}
          <div className="absolute top-8 left-0 w-full h-1 bg-muted/30 rounded-full" />
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {timelineData.length === 0 && (
              <p className="col-span-full text-xs font-medium text-muted-foreground">
                No batches are approaching expiry.
              </p>
            )}
            {timelineData.map((node, idx) => (
              <div key={idx} className="relative flex flex-col items-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-4">
                  {node.label}
                </span>
                
                {/* Node */}
                <div className={`h-4 w-4 rounded-full border-2 mb-4 z-10 ${getUrgencyColor(idx)} ring-4 ring-background`} />
                
                {/* Data */}
                <div className={`flex flex-col items-center p-3 rounded-xl border border-border/50 bg-muted/5 w-full text-center hover:bg-muted/10 transition-colors ${idx === 0 ? 'border-destructive/30 bg-destructive/5' : ''}`}>
                  <span className="text-sm font-black text-foreground">{formatCurrency(node.value)}</span>
                  <span className="text-[10px] font-medium text-muted-foreground mt-0.5">{node.batches} batches</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
