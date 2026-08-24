"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";

export function MonitoringHealth() {
  const monitors = [
    { name: "Inventory Monitoring", active: true },
    { name: "Demand Monitoring", active: true },
    { name: "Expiry Monitoring", active: true },
    { name: "Forecast Monitoring", active: true },
    { name: "Supplier Monitoring", active: true },
    { name: "Alert Engine", active: true },
  ];

  return (
    <Card className="border-border/60 shadow-sm h-full">
      <CardHeader className="pb-3 border-b border-border/30 mb-3 bg-muted/5">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Activity className="h-4 w-4 text-ai" />
          System Health
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-y-3 gap-x-4">
          {monitors.map((m, idx) => (
            <div key={idx} className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">{m.name}</span>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-success shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-success">Active</span>
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Last System Event</p>
          <p className="text-xs font-semibold text-foreground">Stockout risk detected &mdash; 8 minutes ago</p>
        </div>
      </CardContent>
    </Card>
  );
}
