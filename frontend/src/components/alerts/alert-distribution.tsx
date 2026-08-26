"use client";

import { useAlertDistribution } from "@/hooks/use-alerts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TYPE_COLORS = ["bg-destructive", "bg-warning", "bg-primary", "bg-muted-foreground", "bg-muted"];

export function AlertDistribution() {
  const { data, isPending } = useAlertDistribution();

  const types = (data?.byType ?? []).map((row, index) => ({
    name: row.type,
    count: row.count,
    sharePercent: row.sharePercent,
    color: TYPE_COLORS[index % TYPE_COLORS.length]!,
  }));

  // the api counts alerts per location; severity is only broken out globally, so the
  // table shows each location's share of the total rather than a severity split
  const locations = data?.byLocation ?? [];

  if (isPending) return null;

  return (
    <Card className="border-border/60 shadow-sm mt-5">
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/50">

        <div className="p-4 sm:p-5">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="text-sm font-bold">Alerts by Type</CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-3">
            {types.length === 0 && (
              <p className="text-xs font-medium text-muted-foreground">No alerts have been raised.</p>
            )}
            {types.map((type) => (
              <div key={type.name} className="flex items-center gap-3">
                <span className="text-xs font-semibold text-foreground w-28 shrink-0">{type.name}</span>
                <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${type.color}`} style={{ width: `${type.sharePercent}%` }} />
                </div>
                <span className="text-xs font-bold tabular-nums text-muted-foreground w-6 text-right">{type.count}</span>
              </div>
            ))}
          </CardContent>
        </div>

        <div className="p-4 sm:p-5">
          <CardHeader className="p-0 mb-4 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold">Alerts by Distribution Center</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {locations.length === 0 ? (
              <p className="text-xs font-medium text-muted-foreground">No alerts have been raised.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-left">
                    <th className="pb-2 font-bold">Location</th>
                    <th className="pb-2 font-bold">Alerts</th>
                    <th className="pb-2 font-bold text-right">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {locations.map((row) => (
                    <tr key={row.location}>
                      <td className="py-2.5 font-semibold text-foreground">{row.location}</td>
                      <td className="py-2.5 font-bold tabular-nums">{row.count}</td>
                      <td className="py-2.5 font-bold tabular-nums text-muted-foreground text-right">
                        {row.sharePercent}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </div>

      </div>
    </Card>
  );
}
