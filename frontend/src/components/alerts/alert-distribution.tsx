"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const MOCK_TYPES = [
  { name: "Stockout Risk", count: 18, color: "bg-destructive" },
  { name: "Demand Spike", count: 12, color: "bg-warning" },
  { name: "Capacity Breach", count: 8, color: "bg-primary" },
  { name: "Expiry Risk", count: 5, color: "bg-muted-foreground" },
  { name: "Supplier Delay", count: 4, color: "bg-muted-foreground" },
];

const MOCK_DCS = [
  { name: "Northeast DC", total: 14, critical: 2, high: 4, resRate: "94%" },
  { name: "South DC", total: 11, critical: 1, high: 2, resRate: "88%" },
  { name: "West Coast DC", total: 9, critical: 0, high: 1, resRate: "97%" },
  { name: "Midwest DC", total: 13, critical: 0, high: 0, resRate: "100%" },
];

export function AlertDistribution() {
  const maxType = Math.max(...MOCK_TYPES.map(t => t.count));

  return (
    <Card className="border-border/60 shadow-sm mt-5">
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/50">
        
        {/* Left: By Type */}
        <div className="p-4 sm:p-5">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="text-sm font-bold">Alerts by Type</CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-3">
            {MOCK_TYPES.map((type, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <span className="text-xs font-semibold text-foreground w-28 shrink-0">{type.name}</span>
                <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${type.color}`} style={{ width: `${(type.count / maxType) * 100}%` }} />
                </div>
                <span className="text-xs font-bold tabular-nums text-muted-foreground w-6 text-right">{type.count}</span>
              </div>
            ))}
          </CardContent>
        </div>

        {/* Right: By DC */}
        <div className="p-4 sm:p-5">
          <CardHeader className="p-0 mb-4 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold">Alerts by Distribution Center</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-left">
                  <th className="pb-2 font-bold">Location</th>
                  <th className="pb-2 font-bold">Total</th>
                  <th className="pb-2 font-bold">Critical</th>
                  <th className="pb-2 font-bold">High</th>
                  <th className="pb-2 font-bold text-right">Res. Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {MOCK_DCS.map((dc, idx) => (
                  <tr key={idx}>
                    <td className="py-2.5 font-semibold text-foreground">{dc.name}</td>
                    <td className="py-2.5 font-bold tabular-nums">{dc.total}</td>
                    <td className="py-2.5">
                      {dc.critical > 0 ? (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-transparent text-[9px] px-1.5 font-bold">{dc.critical}</Badge>
                      ) : <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="py-2.5">
                      {dc.high > 0 ? (
                        <Badge variant="outline" className="bg-warning/20 text-warning border-transparent text-[9px] px-1.5 font-bold">{dc.high}</Badge>
                      ) : <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="py-2.5 font-bold tabular-nums text-success text-right">{dc.resRate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </div>

      </div>
    </Card>
  );
}
