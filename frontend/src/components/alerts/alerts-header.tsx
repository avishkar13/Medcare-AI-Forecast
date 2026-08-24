"use client";

import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle2 } from "lucide-react";
import { useState } from "react";

interface AlertsHeaderProps {
  onMarkAllRead: () => void;
}

export function AlertsHeader({ onMarkAllRead }: AlertsHeaderProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("02:07 AM");

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setLastUpdated(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
    }, 1000);
  };

  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-4 sm:pt-6 mb-2">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-ai mb-1">
          Real-Time Monitoring
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Alerts &amp; Monitoring</h1>
        <p className="text-sm text-muted-foreground mt-1 font-medium max-w-2xl">
          Monitor inventory, demand, expiry, and supply-chain risks requiring immediate attention.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 md:gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-background border border-border/50 rounded-full shadow-sm">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Monitoring Active</span>
        </div>
        
        <p className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap hidden sm:block">
          Last updated: {lastUpdated}
        </p>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="bg-background text-xs font-semibold h-8" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" className="bg-background text-xs font-semibold h-8" onClick={onMarkAllRead}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            Mark All Read
          </Button>
        </div>
      </div>
    </div>
  );
}
