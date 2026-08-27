"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Eye,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  Package,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import type { InventoryTableItem, InventoryRisk, InventoryDetailStatus } from "@/types/inventory";
import { SkuDetailDrawer } from "@/components/inventory/sku-detail-drawer";
import { useFormatters } from "@/hooks/use-formatters";

/** The four the server can order by - `zod/inventory.schemas.ts` enumerates them. */
export type InventorySort = "sku" | "risk" | "daysOfSupply" | "inventoryValue";

interface InventoryTableProps {
  /** One page of positions, already filtered, sorted and sliced by the server. */
  items: InventoryTableItem[];
  /** Rows in the whole filtered set, from the response meta. */
  total: number;
  page: number;
  pageSize: number;
  sort: InventorySort;
  isFetching?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSortChange: (sort: InventorySort) => void;
  onResetFilters?: () => void;
  /**
   * Carries the current DC onto every link out of this table. A bare `/forecast`
   * dropped the reader on an unfiltered page and left them to find, by hand, the row
   * they had just been looking at.
   */
  withScope?: (href: string, extra?: Record<string, string | undefined>) => string;
}

const PAGE_SIZES = [10, 20, 50, 100];

const getRiskBadge = (risk: InventoryRisk) => {
  const styles: Record<InventoryRisk, string> = {
    critical: "bg-destructive text-[#FFFFFF] hover:bg-destructive shadow-xs border-transparent",
    high: "bg-warning text-[#FFFFFF] hover:bg-warning shadow-xs border-transparent",
    medium: "bg-primary/20 text-primary hover:bg-primary/30 border-transparent",
    low: "bg-muted text-muted-foreground hover:bg-muted/80 border-transparent",
  };
  return styles[risk];
};

const getStatusLabel = (status: InventoryDetailStatus) => {
  const labels: Record<InventoryDetailStatus, string> = {
    healthy: "Healthy",
    belowReorderPoint: "Reorder",
    excessStock: "Overstocked",
    criticalStock: "At Risk",
    expiringSoon: "Expiring",
  };
  return labels[status] || "—";
};

const getStatusColor = (status: InventoryDetailStatus) => {
  const colors: Record<InventoryDetailStatus, string> = {
    healthy: "text-success bg-success/10 border-success/20",
    belowReorderPoint: "text-warning bg-warning/10 border-warning/20",
    excessStock: "text-primary bg-primary/10 border-primary/20",
    criticalStock: "text-destructive bg-destructive/10 border-destructive/20",
    expiringSoon: "text-[#7C3AED] bg-[#7C3AED]/10 border-[#7C3AED]/20",
  };
  return colors[status] || "text-muted-foreground bg-muted border-border";
};

export function InventoryTable({
  items,
  total,
  page,
  pageSize,
  sort,
  isFetching = false,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  onResetFilters,
  withScope = (href) => href,
}: InventoryTableProps) {
  const { formatCurrency, formatNumber } = useFormatters();
  const [selectedSkuId, setSelectedSkuId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);

  const openDrawer = (sku: string) => {
    setSelectedSkuId(sku);
    setIsDrawerOpen(true);
  };

  const renderSortIcon = (key: InventorySort) => {
    if (sort !== key) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/40" />;
    // Every server sort is "worst first" except sku, which is alphabetical. There is
    // no direction to toggle, so the arrow states which way the column already reads.
    return key === "sku" ? (
      <ArrowUp className="h-3 w-3 text-primary" />
    ) : (
      <ArrowDown className="h-3 w-3 text-primary" />
    );
  };

  /** Only the four columns the server can order by are clickable. */
  const sortableHead = (key: InventorySort, label: string, align: "left" | "right" | "center") => (
    <TableHead
      className={`text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground ${
        align === "right" ? "text-right" : align === "center" ? "text-center" : "pl-4"
      }`}
      onClick={() => onSortChange(key)}
    >
      <div
        className={`flex items-center gap-1.5 ${
          align === "right" ? "justify-end" : align === "center" ? "justify-center" : ""
        }`}
      >
        <span>{label}</span>
        {renderSortIcon(key)}
      </div>
    </TableHead>
  );

  const plainHead = (label: string, hint: string, align: "left" | "right") => (
    <TableHead
      title={hint}
      className={`text-xs font-semibold uppercase tracking-wider text-muted-foreground ${
        align === "right" ? "text-right" : ""
      }`}
    >
      {label}
    </TableHead>
  );

  return (
    <>
      <Card className="pb-4 shadow-sm border-border/80">
        <CardHeader className="pb-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Inventory Master Index
              </CardTitle>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                <Sparkles className="h-3 w-3" />
                AI Active
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`text-xs text-muted-foreground tabular-nums font-medium transition-opacity ${
                  isFetching ? "opacity-50" : ""
                }`}
              >
                Showing {firstRow}&ndash;{lastRow} of {formatNumber(total)} positions
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {total === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-4">
              <div className="h-12 w-12 rounded-full bg-muted/60 flex items-center justify-center">
                <Package className="h-6 w-6 text-muted-foreground/60" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-foreground">No inventory records found</p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  No positions match the selected criteria. Try loosening search terms or adjusting
                  filter parameters.
                </p>
              </div>
              {onResetFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onResetFilters}
                  className="mt-2 gap-1.5 cursor-pointer text-xs"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset all filters
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* DESKTOP / TABLET DATA TABLE */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border">
                      {sortableHead("sku", "SKU / Product", "left")}
                      {plainHead("Location", "Distribution center holding this position", "left")}
                      {plainHead("On Hand", "Physical units held at this location", "right")}
                      {plainHead(
                        "Reserved",
                        "Committed to orders - held on site but not sellable",
                        "right",
                      )}
                      {plainHead(
                        "In Transit",
                        "Inbound on a purchase order or transfer, not yet received",
                        "right",
                      )}
                      {plainHead(
                        "Available",
                        "On hand minus reserved - what can be promised today",
                        "right",
                      )}
                      {plainHead(
                        "Safety Target",
                        "Safety stock the position should not fall below",
                        "right",
                      )}
                      {sortableHead("daysOfSupply", "Days Supply", "right")}
                      {sortableHead("inventoryValue", "Capital Value", "right")}
                      {sortableHead("risk", "Risk Profile", "center")}
                      {plainHead("Status", "Derived stock condition", "left")}
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center pr-4 w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const hasAiAction = item.risk === "critical" || item.risk === "high";

                      return (
                        <TableRow
                          key={item.id}
                          className={`group cursor-pointer transition-colors ${
                            item.risk === "critical"
                              ? "hover:bg-destructive/5"
                              : item.risk === "high"
                                ? "hover:bg-warning/5"
                                : "hover:bg-muted/40"
                          }`}
                          onClick={() => openDrawer(item.sku)}
                        >
                          <TableCell className="pl-4 py-3">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-bold text-primary group-hover:underline flex items-center gap-1">
                                  {item.sku}
                                </span>
                                {hasAiAction && (
                                  <span
                                    className="flex h-1.5 w-1.5 rounded-full bg-primary"
                                    title="AI Recommendation Active"
                                  />
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground truncate max-w-[210px]">
                                {item.name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-foreground">
                                {item.location}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {item.category ?? "Uncategorised"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-3">
                            <div className="flex flex-col items-end">
                              <span
                                className={`text-sm font-bold tabular-nums ${
                                  item.onHand < item.safetyStock
                                    ? "text-destructive"
                                    : "text-foreground"
                                }`}
                              >
                                {formatNumber(item.onHand)}
                              </span>
                              <span className="text-[10px] text-muted-foreground tabular-nums">
                                {item.bufferCoveragePercent}% of buffer
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-3 text-sm tabular-nums font-medium">
                            {item.reserved > 0 ? (
                              <span className="text-warning">{formatNumber(item.reserved)}</span>
                            ) : (
                              <span className="text-muted-foreground/50">&mdash;</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right py-3 text-sm tabular-nums font-medium">
                            {item.inTransit > 0 ? (
                              <span className="text-primary">+{formatNumber(item.inTransit)}</span>
                            ) : (
                              <span className="text-muted-foreground/50">&mdash;</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right py-3">
                            <span
                              className={`text-sm font-bold tabular-nums ${
                                item.available <= 0
                                  ? "text-destructive"
                                  : item.available < item.safetyStock
                                    ? "text-warning"
                                    : "text-foreground"
                              }`}
                            >
                              {formatNumber(item.available)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right py-3 text-sm tabular-nums text-muted-foreground font-medium">
                            {formatNumber(item.safetyStock)}
                          </TableCell>
                          <TableCell className="text-right py-3">
                            <span
                              className={`text-sm font-bold tabular-nums inline-block px-1.5 py-0.5 rounded text-xs ${
                                item.daysOfSupply <= 7
                                  ? "bg-destructive/15 text-destructive font-bold"
                                  : item.daysOfSupply <= 14
                                    ? "bg-warning/15 text-warning font-bold"
                                    : "text-foreground font-medium"
                              }`}
                            >
                              {item.daysOfSupply}d
                            </span>
                          </TableCell>
                          <TableCell className="text-right py-3 text-sm tabular-nums text-foreground font-medium">
                            {formatCurrency(item.inventoryValue)}
                          </TableCell>
                          <TableCell className="text-center py-3">
                            <Badge
                              className={`capitalize text-xs font-semibold ${getRiskBadge(item.risk)}`}
                            >
                              {item.risk}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3">
                            <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded border inline-block whitespace-nowrap ${getStatusColor(item.status)}`}
                            >
                              {getStatusLabel(item.status)}
                            </span>
                          </TableCell>
                          <TableCell
                            className="text-center pr-4 py-3"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <button className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted transition-colors cursor-pointer opacity-70 group-hover:opacity-100 focus:opacity-100">
                                    <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                                  </button>
                                }
                              />
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  className="gap-2 cursor-pointer text-xs font-medium"
                                  onClick={() => openDrawer(item.sku)}
                                >
                                  <Eye className="h-3.5 w-3.5 text-primary" />
                                  View SKU Details
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="gap-2 cursor-pointer text-xs font-medium"
                                  onClick={() => openDrawer(item.sku)}
                                >
                                  <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                                  View Risk Diagnostics
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="gap-2 cursor-pointer text-xs font-medium"
                                  render={
                                    <Link href={withScope("/forecast", { sku: item.sku })}>
                                      <TrendingUp className="h-3.5 w-3.5 text-primary" />
                                      View Demand Forecast
                                    </Link>
                                  }
                                />
                                <DropdownMenuItem
                                  className="gap-2 cursor-pointer text-xs font-medium"
                                  render={
                                    <Link href={withScope("/recommendations", { sku: item.sku })}>
                                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                                      View Recommendation
                                    </Link>
                                  }
                                />
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="gap-2 cursor-pointer text-xs font-semibold text-primary"
                                  onClick={() => openDrawer(item.sku)}
                                >
                                  <ShoppingCart className="h-3.5 w-3.5 text-success" />
                                  Quick Replenish
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* MOBILE ADAPTIVE CARD LIST */}
              <div className="md:hidden flex flex-col divide-y divide-border">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 flex flex-col gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => openDrawer(item.sku)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="font-mono text-sm font-bold text-primary">{item.sku}</span>
                        <span className="text-xs font-medium text-foreground">{item.name}</span>
                      </div>
                      <Badge
                        className={`capitalize text-xs font-semibold ${getRiskBadge(item.risk)}`}
                      >
                        {item.risk}
                      </Badge>
                    </div>

                    {/* The stock split, which is the whole point of the row on a phone. */}
                    <div className="grid grid-cols-4 gap-2 p-2 bg-muted/40 rounded-lg text-center">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground">On Hand</span>
                        <span
                          className={`text-xs font-bold tabular-nums ${
                            item.onHand < item.safetyStock ? "text-destructive" : "text-foreground"
                          }`}
                        >
                          {formatNumber(item.onHand)}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground">Reserved</span>
                        <span className="text-xs font-bold tabular-nums text-warning">
                          {formatNumber(item.reserved)}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground">In Transit</span>
                        <span className="text-xs font-bold tabular-nums text-primary">
                          {formatNumber(item.inTransit)}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground">Available</span>
                        <span
                          className={`text-xs font-bold tabular-nums ${
                            item.available <= 0 ? "text-destructive" : "text-foreground"
                          }`}
                        >
                          {formatNumber(item.available)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground">Safety</span>
                        <span className="text-xs font-semibold tabular-nums text-foreground">
                          {formatNumber(item.safetyStock)}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground">Days Supply</span>
                        <span className="text-xs font-semibold tabular-nums text-foreground">
                          {item.daysOfSupply}d
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground">Value</span>
                        <span className="text-xs font-semibold tabular-nums text-foreground">
                          {formatCurrency(item.inventoryValue)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                      <span>
                        {item.location} &bull; {item.category ?? "Uncategorised"}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${getStatusColor(item.status)}`}
                      >
                        {getStatusLabel(item.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* PAGINATION TOOLBAR */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 pt-4 border-t border-border/50">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Rows per page:</span>
                  <select
                    className="h-7 rounded-md border border-input bg-background px-2 text-xs cursor-pointer shadow-xs focus-visible:ring-1 focus-visible:ring-ring"
                    value={pageSize}
                    onChange={(e) => onPageSizeChange(Number(e.target.value))}
                  >
                    {PAGE_SIZES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="tabular-nums font-medium">
                    Page {page} of {totalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0 cursor-pointer"
                      disabled={page <= 1 || isFetching}
                      onClick={() => onPageChange(page - 1)}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0 cursor-pointer"
                      disabled={page >= totalPages || isFetching}
                      onClick={() => onPageChange(page + 1)}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <SkuDetailDrawer
        skuId={selectedSkuId}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </>
  );
}
