"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDashboardExpiryRisk } from "@/hooks/use-dashboard";
import { useFormatters } from "@/hooks/use-formatters";
import { Info, FlaskConical } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ExpiryRiskPanel() {
  const { data, isPending, isError } = useDashboardExpiryRisk();
  // Shared formatter, not a local one: this panel hardcoded USD and so reported
  // value at risk in dollars on a workspace configured for rupees.
  const { formatCurrency } = useFormatters();

  const risks = (data?.items ?? []).map((item) => ({
    id: item.batchId,
    batchId: item.batchNumber,
    sku: item.sku,
    dc: item.warehouseCode,
    currentQuantity: item.quantity,
    inventoryValue: item.valueAtRisk,
    daysToExpiry: item.daysToExpiry,
    severity: item.severity,
  }));

  if (isPending || isError) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          {isPending ? "Loading expiry risk…" : "Could not load expiry risk."}
        </CardContent>
      </Card>
    );
  }

  const getSeverityStyles = (severity: string) => {
    switch(severity) {
      case "critical": return "bg-destructive text-[#FFFFFF] hover:bg-destructive/90 border-transparent";
      case "high": return "bg-warning text-[#FFFFFF] hover:bg-warning/90 border-transparent";
      case "medium": return "bg-primary/20 text-primary hover:bg-primary/30";
      case "low": return "bg-muted text-muted-foreground hover:bg-muted/80";
      default: return "";
    }
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-4 border-b border-border/50">
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="h-4 w-4 text-warning" />
          Expiry Risk
          <Tooltip>
            <TooltipTrigger render={<Info className="h-4 w-4 text-muted-foreground cursor-help" />} />
            <TooltipContent>
              <p className="max-w-xs">WHAT may be wasted. Identifies specific batches approaching expiration to trigger discounting, inter-DC transfers, or priority fulfillment.</p>
            </TooltipContent>
          </Tooltip>
        </CardTitle>
        <CardDescription>High-risk batches requiring intervention</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-y-auto max-h-[350px]">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-muted/80 backdrop-blur sticky top-0 uppercase border-b border-border/50 z-10">
              <tr>
                <th className="px-4 py-3 font-medium">Batch / SKU</th>
                <th className="px-4 py-3 font-medium">DC Location</th>
                <th className="px-4 py-3 font-medium text-right">Quantity</th>
                <th className="px-4 py-3 font-medium text-right">Value at Risk</th>
                <th className="px-4 py-3 font-medium text-right">Expires In</th>
                <th className="px-4 py-3 font-medium text-center">Severity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {risks.map((risk) => (
                <tr key={risk.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground">{risk.batchId}</span>
                      <span className="text-xs text-muted-foreground font-mono">{risk.sku}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{risk.dc}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{risk.currentQuantity}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatCurrency(risk.inventoryValue)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-bold ${risk.daysToExpiry <= 30 ? 'text-destructive' : 'text-foreground'}`}>
                      {risk.daysToExpiry}d
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant="outline" className={`capitalize border-transparent ${getSeverityStyles(risk.severity)}`}>
                      {risk.severity}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
