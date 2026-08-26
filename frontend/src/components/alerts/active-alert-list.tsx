"use client";

import { SystemAlert } from "@/types/alert";
import { AlertRow } from "@/components/alerts/alert-row";
import { CheckCircle2 } from "lucide-react";

interface ActiveAlertListProps {
  alerts: SystemAlert[];
  unresolvedCount: number;
  onReview: (alert: SystemAlert) => void;
}

export function ActiveAlertList({ alerts, unresolvedCount, onReview }: ActiveAlertListProps) {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="bg-background border border-border/60 rounded-xl p-12 shadow-sm flex flex-col items-center justify-center text-center">
        <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mb-4 border border-success/20">
          <CheckCircle2 className="h-8 w-8 text-success" />
        </div>
        <h3 className="text-lg font-bold text-foreground">You&apos;re all clear</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">No active supply-chain risks require attention. Your network is operating within expected parameters.</p>
      </div>
    );
  }

  return (
    <div className="bg-background border border-border/60 rounded-xl shadow-sm overflow-hidden flex flex-col">
      <div className="p-4 border-b border-border/50 flex items-center justify-between bg-muted/10">
        <div>
          <h2 className="text-sm font-bold text-foreground">Active Alerts</h2>
          <p className="text-[10px] font-medium text-muted-foreground mt-0.5">Prioritized events requiring operational attention.</p>
        </div>
        <div className="text-[10px] font-bold text-foreground bg-background px-2.5 py-1 rounded-md border border-border/50 shadow-sm">
          {unresolvedCount} Unresolved
        </div>
      </div>

      {/* Desktop Table Header */}
      <div className="hidden md:grid grid-cols-[80px_1fr_1.5fr_1fr_1fr_120px_100px] gap-4 p-3 border-b border-border/50 bg-muted/5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <div>Severity</div>
        <div>Alert Type</div>
        <div>Issue &amp; Location</div>
        <div>Business Impact</div>
        <div>Detected</div>
        <div>Status</div>
        <div className="text-right pr-2">Action</div>
      </div>

      {/* List content with definite height and scrolling */}
      <div className="flex flex-col divide-y divide-border/30 max-h-[600px] overflow-y-auto">
        {alerts.map((alert) => (
          <AlertRow key={alert.id} alert={alert} onReview={() => onReview(alert)} />
        ))}
      </div>
    </div>
  );
}
