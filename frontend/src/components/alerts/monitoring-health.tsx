"use client";

import { useAlertHealth } from "@/hooks/use-alerts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";

const relativeTime = (iso: string) => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 60) return `${minutes} minutes ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} hours ago`;
  return `${Math.round(minutes / 1440)} days ago`;
};

export function MonitoringHealth() {
  const { data, isPending } = useAlertHealth();

  if (isPending || !data) return null;

  // the api reports the alert pipeline itself, not a list of subsystems, so these
  // are the four facts it can actually vouch for
  const stats = [
    { label: "Alerts tracked", value: String(data.alertsTracked) },
    { label: "Open", value: String(data.openAlerts) },
    {
      label: "Oldest open",
      value: data.oldestOpenAgeDays === null ? "none" : `${data.oldestOpenAgeDays}d`,
    },
    {
      label: "Last detected",
      value: data.lastDetectedAt
        ? new Date(data.lastDetectedAt).toLocaleDateString()
        : "never",
    },
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
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
              <span className="text-xs font-bold tabular-nums text-foreground">{stat.value}</span>
            </div>
          ))}
        </div>

        <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Last System Event</p>
          <p className="text-xs font-semibold text-foreground">
            {data.lastDetectedAt
              ? `Alert detected ${relativeTime(data.lastDetectedAt)}`
              : "No alerts have been detected yet"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
