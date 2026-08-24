"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Activity, RefreshCcw } from "lucide-react";

interface ExpiryHeaderProps {
  fefoActive: boolean;
  onFefoToggle: (active: boolean) => void;
}

export function ExpiryHeader({ fefoActive, onFefoToggle }: ExpiryHeaderProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
      <div>
        <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5" />
          Expiry Intelligence
        </p>
        <h1 className="text-3xl font-black tracking-tight text-foreground">
          Expiry Risk
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Identify at-risk pharmaceutical batches and optimize inventory before expiry.
        </p>
      </div>

      <div className="flex items-center gap-4 bg-background border border-border/60 px-4 py-2.5 rounded-xl shadow-sm">
        <div className="flex items-center gap-2 pr-4 border-r border-border/50">
          <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
          <span className="text-xs font-bold text-muted-foreground">Monitoring Active</span>
        </div>
        
        <div className="flex items-center gap-2 pr-4 border-r border-border/50 text-xs text-muted-foreground">
          <span>Updated 02:08 AM</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleRefresh}>
            <RefreshCcw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="fefo-mode" className="text-xs font-bold cursor-pointer">
            FEFO View
          </Label>
          <button
            id="fefo-mode"
            role="switch"
            aria-checked={fefoActive}
            onClick={() => onFefoToggle(!fefoActive)}
            className={`
              peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50
              ${fefoActive ? "bg-primary" : "bg-input"}
            `}
          >
            <span
              className={`
                pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform
                ${fefoActive ? "translate-x-4" : "translate-x-0"}
              `}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
