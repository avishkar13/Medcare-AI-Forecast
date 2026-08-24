"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeftRight,
  Sparkles,
  ShoppingCart,
  AlertTriangle,
  Clock,
  Building2,
  CheckCircle2,
  LineChart,
} from "lucide-react";
import { getSkuDetailData } from "@/lib/mockData";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { StockBatch, StockMovement, MovementType, InventoryRisk } from "@/types/inventory";
import Link from "next/link";

interface SkuDetailDrawerProps {
  skuId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SkuDetailDrawer({ skuId, isOpen, onClose }: SkuDetailDrawerProps) {
  const [replenishSuccess, setReplenishSuccess] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState(false);

  if (!skuId) return null;

  const item = getSkuDetailData(skuId);

  const getRiskBadge = (risk: InventoryRisk) => {
    const styles: Record<InventoryRisk, string> = {
      critical: "bg-destructive text-[#FFFFFF] hover:bg-destructive shadow-xs border-transparent",
      high: "bg-warning text-[#FFFFFF] hover:bg-warning shadow-xs border-transparent",
      medium: "bg-primary/20 text-primary hover:bg-primary/30 border-transparent",
      low: "bg-muted text-muted-foreground hover:bg-muted/80 border-transparent",
    };
    return styles[risk] || styles.low;
  };

  const getMovementBadge = (type: MovementType) => {
    switch (type) {
      case "Replenishment":
      case "Purchase":
        return "bg-success/15 text-success border-success/30";
      case "Transfer":
        return "bg-primary/15 text-primary border-primary/30";
      case "Consumption":
        return "bg-muted text-foreground border-border";
      case "Adjustment":
        return "bg-warning/15 text-warning border-warning/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const maxTrack = Math.max(item.maximumStock, item.onHand * 1.15, item.reorderPoint * 1.2);
  const onHandPct = Math.min(100, Math.round((item.onHand / maxTrack) * 100));
  const safetyPct = Math.min(100, Math.round((item.safetyStock / maxTrack) * 100));
  const reorderPct = Math.min(100, Math.round((item.reorderPoint / maxTrack) * 100));

  const handleReplenish = () => {
    setReplenishSuccess(true);
    setTimeout(() => setReplenishSuccess(false), 3000);
  };

  const handleTransfer = () => {
    setTransferSuccess(true);
    setTimeout(() => setTransferSuccess(false), 3000);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl lg:max-w-3xl xl:max-w-4xl p-0 gap-0 border-l border-border bg-background shadow-2xl flex flex-col h-full overflow-hidden"
      >
        {/* FIXED HEADER */}
        <SheetHeader className="p-6 pb-4 border-b border-border bg-muted/20 shrink-0">
          <div className="flex items-start justify-between gap-4 pr-8">
            <div className="flex flex-col gap-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-bold text-primary px-2.5 py-0.5 rounded-md bg-primary/10 border border-primary/20 shrink-0">
                  {item.id}
                </span>
                <Badge className={`capitalize shrink-0 ${getRiskBadge(item.risk)}`}>
                  {item.risk} Risk
                </Badge>
                <span className="text-xs font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded shrink-0">
                  {item.category}
                </span>
              </div>
              <SheetTitle className="text-xl font-bold tracking-tight text-foreground mt-1 truncate">
                {item.name}
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="inline-flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground/70" />
                  <span className="font-medium text-foreground">{item.manufacturer}</span>
                </span>
                <span>&bull;</span>
                <span className="font-medium text-foreground">{item.location}</span>
              </SheetDescription>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-border/50">
            <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-card/60 border border-border/40">
              <span className="text-[11px] font-medium text-muted-foreground">On Hand Stock</span>
              <span className={`text-base sm:text-lg font-bold tabular-nums ${item.onHand < item.safetyStock ? "text-destructive" : "text-foreground"}`}>
                {formatNumber(item.onHand)} <span className="text-xs font-normal text-muted-foreground">units</span>
              </span>
            </div>
            <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-card/60 border border-border/40">
              <span className="text-[11px] font-medium text-muted-foreground">Days of Supply</span>
              <span className={`text-base sm:text-lg font-bold tabular-nums ${item.daysOfSupply <= 7 ? "text-destructive" : item.daysOfSupply <= 14 ? "text-warning" : "text-foreground"}`}>
                {item.daysOfSupply} <span className="text-xs font-normal text-muted-foreground">days</span>
              </span>
            </div>
            <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-card/60 border border-border/40">
              <span className="text-[11px] font-medium text-muted-foreground">Unit Price</span>
              <span className="text-base sm:text-lg font-bold tabular-nums text-foreground">
                ${item.unitValue.toFixed(2)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-card/60 border border-border/40">
              <span className="text-[11px] font-medium text-muted-foreground">Capital Value</span>
              <span className="text-base sm:text-lg font-bold tabular-nums text-foreground">
                {formatCurrency(item.inventoryValue)}
              </span>
            </div>
          </div>
        </SheetHeader>

        {/* SCROLLABLE BODY CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="w-full grid grid-cols-4 bg-muted/60 p-1 rounded-lg">
              <TabsTrigger value="overview" className="text-xs font-semibold">
                Overview
              </TabsTrigger>
              <TabsTrigger value="batches" className="text-xs font-semibold">
                Batches ({item.batches.length})
              </TabsTrigger>
              <TabsTrigger value="movements" className="text-xs font-semibold">
                Movements
              </TabsTrigger>
              <TabsTrigger value="ai-reasoning" className="text-xs font-semibold">
                AI Insight
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: OVERVIEW */}
            <TabsContent value="overview" className="flex flex-col gap-6 mt-4">
              {/* Visual Stock Level Comparison */}
              <div className="p-4 rounded-xl border border-border bg-card flex flex-col gap-3.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    Stock Level vs Capacity Thresholds
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    Max Capacity: {formatNumber(item.maximumStock)} units
                  </span>
                </div>

                {/* Progress Visual Track */}
                <div className="relative w-full h-8 bg-muted/50 rounded-lg overflow-hidden flex items-center px-2">
                  {/* Safety Stock Marker Band */}
                  <div
                    className="absolute top-0 bottom-0 bg-warning/15 border-r-2 border-warning/60"
                    style={{ width: `${safetyPct}%` }}
                    title={`Safety Buffer: ${formatNumber(item.safetyStock)} units`}
                  />
                  {/* Reorder Point Marker Band */}
                  <div
                    className="absolute top-0 bottom-0 border-r-2 border-dashed border-primary z-10"
                    style={{ left: `${reorderPct}%` }}
                    title={`Reorder Point: ${formatNumber(item.reorderPoint)} units`}
                  />
                  {/* On Hand Fill */}
                  <div
                    className={`h-3.5 rounded transition-all ${
                      item.onHand < item.safetyStock
                        ? "bg-destructive"
                        : item.onHand <= item.reorderPoint
                        ? "bg-warning"
                        : "bg-success"
                    }`}
                    style={{ width: `${onHandPct}%` }}
                  />
                </div>

                {/* Markers Legend */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                  <div className="flex flex-col items-center p-1.5 rounded bg-muted/20 border border-border/40">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Current Stock</span>
                    <span className="text-xs font-bold tabular-nums text-foreground">{formatNumber(item.onHand)}</span>
                  </div>
                  <div className="flex flex-col items-center p-1.5 rounded bg-warning/10 border border-warning/20">
                    <span className="text-[10px] uppercase tracking-wider text-warning font-semibold">Safety Stock</span>
                    <span className="text-xs font-bold tabular-nums text-warning">{formatNumber(item.safetyStock)}</span>
                  </div>
                  <div className="flex flex-col items-center p-1.5 rounded bg-primary/10 border border-primary/20">
                    <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">Reorder Target</span>
                    <span className="text-xs font-bold tabular-nums text-primary">{formatNumber(item.reorderPoint)}</span>
                  </div>
                  <div className="flex flex-col items-center p-1.5 rounded bg-muted/20 border border-border/40">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Max Capacity</span>
                    <span className="text-xs font-bold tabular-nums text-foreground">{formatNumber(item.maximumStock)}</span>
                  </div>
                </div>
              </div>

              {/* Operational Parameters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-lg border border-border/60 bg-muted/10 flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-muted-foreground">Avg Daily Demand</span>
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {item.avgDailyDemand} <span className="text-xs font-normal text-muted-foreground">units/day</span>
                  </span>
                </div>
                <div className="p-3.5 rounded-lg border border-border/60 bg-muted/10 flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-muted-foreground">Supplier Lead Time</span>
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {item.leadTimeDays} <span className="text-xs font-normal text-muted-foreground">days</span>
                  </span>
                </div>
                <div className="p-3.5 rounded-lg border border-border/60 bg-muted/10 flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-muted-foreground">Location Facility</span>
                  <span className="text-sm font-semibold text-foreground truncate">
                    {item.location}
                  </span>
                </div>
              </div>

              {/* Active Risk Diagnostics */}
              <div className="flex flex-col gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Active Risk Diagnostics
                </span>

                {/* Stockout Risk Card */}
                <div className={`p-4 rounded-xl border flex items-start gap-3.5 ${
                  item.stockoutRiskLevel === "critical"
                    ? "bg-destructive/10 border-destructive/30"
                    : item.stockoutRiskLevel === "high"
                    ? "bg-warning/10 border-warning/30"
                    : "bg-muted/20 border-border/50"
                }`}>
                  <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${
                    item.stockoutRiskLevel === "critical"
                      ? "text-destructive"
                      : item.stockoutRiskLevel === "high"
                      ? "text-warning"
                      : "text-muted-foreground"
                  }`} />
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Stockout Risk: <span className="capitalize">{item.stockoutRiskLevel}</span>
                    </span>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {item.stockoutRiskReason}
                    </p>
                  </div>
                </div>

                {/* Expiry Risk Card */}
                <div className={`p-4 rounded-xl border flex items-start gap-3.5 ${
                  item.expiryRiskLevel === "critical" || item.expiryRiskLevel === "high"
                    ? "bg-warning/10 border-warning/30"
                    : "bg-muted/20 border-border/50"
                }`}>
                  <Clock className={`h-4 w-4 shrink-0 mt-0.5 ${
                    item.expiryRiskLevel === "critical" || item.expiryRiskLevel === "high"
                      ? "text-warning"
                      : "text-muted-foreground"
                  }`} />
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Expiry Risk: <span className="capitalize">{item.expiryRiskLevel}</span>
                    </span>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {item.expiryRiskReason}
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: BATCHES & EXPIRY (FEFO) */}
            <TabsContent value="batches" className="flex flex-col gap-4 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-foreground">FEFO Batch Allocation</h4>
                  <p className="text-xs text-muted-foreground">First-Expiring First-Out logistics dispatch prioritization</p>
                </div>
                <Badge variant="outline" className="text-xs font-mono">
                  {item.batches.length} Active Batches
                </Badge>
              </div>

              <div className="rounded-xl border border-border overflow-x-auto shadow-xs">
                <table className="w-full text-xs text-left min-w-[500px]">
                  <thead className="bg-muted/40 uppercase tracking-wider text-muted-foreground border-b border-border">
                    <tr>
                      <th className="p-3 font-semibold pl-4">Batch ID</th>
                      <th className="p-3 font-semibold">Location Bay</th>
                      <th className="p-3 font-semibold text-right">Quantity</th>
                      <th className="p-3 font-semibold">Expiry Date</th>
                      <th className="p-3 font-semibold text-right">Days Left</th>
                      <th className="p-3 font-semibold text-center pr-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {item.batches.map((b: StockBatch) => (
                      <tr key={b.id} className={b.daysRemaining <= 45 ? "bg-destructive/5 hover:bg-destructive/10" : "hover:bg-muted/20"}>
                        <td className="p-3 pl-4 font-mono font-semibold text-foreground">{b.id}</td>
                        <td className="p-3 text-muted-foreground">{b.location}</td>
                        <td className="p-3 font-semibold text-right tabular-nums text-foreground">
                          {formatNumber(b.quantity)}
                        </td>
                        <td className="p-3 text-foreground font-mono">{b.expiryDate.split("T")[0]}</td>
                        <td className="p-3 text-right tabular-nums">
                          <span className={`font-bold ${b.daysRemaining <= 30 ? "text-destructive" : b.daysRemaining <= 60 ? "text-warning" : "text-foreground"}`}>
                            {b.daysRemaining}d
                          </span>
                        </td>
                        <td className="p-3 text-center pr-4">
                          <Badge
                            className={`text-[10px] uppercase border-transparent ${
                              b.expiryRisk === "critical"
                                ? "bg-destructive text-white"
                                : b.expiryRisk === "high"
                                ? "bg-warning text-white"
                                : "bg-success/20 text-success"
                            }`}
                          >
                            {b.expiryRisk}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* TAB 3: STOCK MOVEMENTS */}
            <TabsContent value="movements" className="flex flex-col gap-4 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-foreground">Audit Trail & Movement History</h4>
                  <p className="text-xs text-muted-foreground">Recent inbound and outbound logistics records</p>
                </div>
              </div>

              <div className="rounded-xl border border-border overflow-x-auto shadow-xs">
                <table className="w-full text-xs text-left min-w-[540px]">
                  <thead className="bg-muted/40 uppercase tracking-wider text-muted-foreground border-b border-border">
                    <tr>
                      <th className="p-3 font-semibold pl-4">Date</th>
                      <th className="p-3 font-semibold">Type</th>
                      <th className="p-3 font-semibold text-right">Quantity</th>
                      <th className="p-3 font-semibold">Route (From &rarr; To)</th>
                      <th className="p-3 font-semibold">Reference</th>
                      <th className="p-3 font-semibold pr-4">Actor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {item.movements.map((m: StockMovement) => (
                      <tr key={m.id} className="hover:bg-muted/20">
                        <td className="p-3 pl-4 text-muted-foreground font-mono">{m.date.split("T")[0]}</td>
                        <td className="p-3">
                          <Badge variant="outline" className={`text-[10px] font-semibold ${getMovementBadge(m.movementType)}`}>
                            {m.movementType}
                          </Badge>
                        </td>
                        <td className="p-3 font-semibold text-right tabular-nums">
                          <span className={m.quantity < 0 ? "text-muted-foreground" : "text-success font-bold"}>
                            {m.quantity > 0 ? `+${formatNumber(m.quantity)}` : formatNumber(m.quantity)}
                          </span>
                        </td>
                        <td className="p-3 text-foreground font-medium truncate max-w-[180px]">
                          {m.fromLocation} &rarr; {m.toLocation}
                        </td>
                        <td className="p-3 font-mono text-muted-foreground">{m.reference}</td>
                        <td className="p-3 text-muted-foreground pr-4">{m.userOrSystem}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* TAB 4: AI REASONING & INSIGHT */}
            <TabsContent value="ai-reasoning" className="flex flex-col gap-4 mt-4">
              <div className="p-5 rounded-xl border border-primary/30 bg-primary/5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-primary font-bold text-base">
                    <Sparkles className="h-5 w-5" />
                    AI Inventory Prescription
                  </div>
                  <Badge className="bg-primary text-primary-foreground font-semibold">
                    {item.aiRecommendation.confidence}% Confidence
                  </Badge>
                </div>

                <div className="p-3.5 bg-background rounded-lg border border-primary/20 flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-primary">Recommended Action</span>
                  <span className="text-base font-bold text-foreground">
                    {item.aiRecommendation.action}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-foreground">Operational Reasoning:</span>
                  <p className="text-xs text-muted-foreground leading-relaxed bg-background/80 p-3.5 rounded-lg border border-border/50">
                    {item.aiRecommendation.reasoning}
                  </p>
                </div>

                <div className="p-3.5 bg-success/10 border border-success/20 rounded-lg flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-success">Expected Business Impact</span>
                  <span className="text-sm font-semibold text-success/90">
                    {item.aiRecommendation.expectedImpact}
                  </span>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Toast Notification Banner */}
          {replenishSuccess && (
            <div className="p-3.5 bg-success/15 border border-success/30 rounded-lg flex items-center gap-2 text-xs font-semibold text-success shadow-xs">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Purchase order drafted for {formatNumber(item.aiRecommendation.suggestedQuantity)} units of {item.name}!</span>
            </div>
          )}
          {transferSuccess && (
            <div className="p-3.5 bg-primary/15 border border-primary/30 rounded-lg flex items-center gap-2 text-xs font-semibold text-primary shadow-xs">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Internal transfer requisition initiated for {item.name}.</span>
            </div>
          )}
        </div>

        {/* FIXED FOOTER ACTION TOOLBAR */}
        <div className="p-4 border-t border-border bg-background/95 backdrop-blur shrink-0 flex flex-wrap items-center justify-between gap-3 z-10 shadow-lg">
          <div className="flex items-center gap-2">
            <Link
              href="/forecast"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background hover:bg-muted hover:text-foreground text-xs font-medium h-8 px-3 transition-colors cursor-pointer"
            >
              <LineChart className="h-3.5 w-3.5 text-primary" />
              View Forecast
            </Link>
            <Link
              href="/recommendations"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background hover:bg-muted hover:text-foreground text-xs font-medium h-8 px-3 transition-colors cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              All Recommendations
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="h-8 px-3 gap-1.5 cursor-pointer text-xs font-medium"
              onClick={handleTransfer}
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Transfer Stock
            </Button>
            <Button
              size="sm"
              className={`h-8 px-4 gap-1.5 cursor-pointer text-xs font-bold text-white shadow-sm transition-all ${
                item.risk === "critical"
                  ? "bg-destructive hover:bg-destructive/90 shadow-destructive/20"
                  : item.risk === "high"
                  ? "bg-warning hover:bg-warning/90 shadow-warning/20"
                  : "bg-primary hover:bg-primary/90 shadow-primary/20"
              }`}
              onClick={handleReplenish}
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              Quick Replenish
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
