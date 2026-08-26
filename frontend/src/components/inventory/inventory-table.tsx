"use client";

import { useState, useMemo } from "react";
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
import { formatCurrency, formatNumber } from "@/lib/utils";

interface InventoryTableProps {
  items: InventoryTableItem[];
  onResetFilters?: () => void;
}

type SortKey = "id" | "name" | "location" | "onHand" | "safetyStock" | "daysOfSupply" | "inventoryValue" | "risk" | "status";
type SortDirection = "asc" | "desc";

const PAGE_SIZES = [5, 10, 20, 50];

const RISK_WEIGHTS: Record<InventoryRisk, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

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
    reorder_required: "Reorder",
    overstocked: "Overstocked",
    at_risk: "At Risk",
    expiring: "Expiring",
  };
  return labels[status];
};

const getStatusColor = (status: InventoryDetailStatus) => {
  const colors: Record<InventoryDetailStatus, string> = {
    healthy: "text-success bg-success/10 border-success/20",
    reorder_required: "text-warning bg-warning/10 border-warning/20",
    overstocked: "text-primary bg-primary/10 border-primary/20",
    at_risk: "text-destructive bg-destructive/10 border-destructive/20",
    expiring: "text-[#7C3AED] bg-[#7C3AED]/10 border-[#7C3AED]/20",
  };
  return colors[status];
};

export function InventoryTable({ items, onResetFilters }: InventoryTableProps) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<SortKey>("risk");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedSkuId, setSelectedSkuId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      let aVal: string | number = a[sortKey];
      let bVal: string | number = b[sortKey];

      if (sortKey === "risk") {
        aVal = RISK_WEIGHTS[a.risk];
        bVal = RISK_WEIGHTS[b.risk];
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });
  }, [items, sortKey, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize));
  const safeCurrentPage = Math.min(page, totalPages - 1);
  const paginatedItems = sortedItems.slice(safeCurrentPage * pageSize, (safeCurrentPage + 1) * pageSize);

  if (page !== safeCurrentPage) {
    setPage(safeCurrentPage);
  }

  const openDrawer = (skuId: string) => {
    setSelectedSkuId(skuId);
    setIsDrawerOpen(true);
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) {
      return <ArrowUpDown className="h-3 w-3 text-muted-foreground/40" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-3 w-3 text-primary" />
    ) : (
      <ArrowDown className="h-3 w-3 text-primary" />
    );
  };

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
              <span className="text-xs text-muted-foreground tabular-nums font-medium">
                Showing {sortedItems.length === 0 ? 0 : safeCurrentPage * pageSize + 1}&ndash;
                {Math.min((safeCurrentPage + 1) * pageSize, sortedItems.length)} of {sortedItems.length} SKUs
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {sortedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-4">
              <div className="h-12 w-12 rounded-full bg-muted/60 flex items-center justify-center">
                <Package className="h-6 w-6 text-muted-foreground/60" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-foreground">No inventory records found</p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  No SKUs match the selected criteria. Try loosening search terms or adjusting filter parameters.
                </p>
              </div>
              {onResetFilters && (
                <Button variant="outline" size="sm" onClick={onResetFilters} className="mt-2 gap-1.5 cursor-pointer text-xs">
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
                      <TableHead
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pl-4 cursor-pointer select-none hover:text-foreground"
                        onClick={() => handleSort("id")}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>SKU / Product</span>
                          {renderSortIcon("id")}
                        </div>
                      </TableHead>
                      <TableHead
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground"
                        onClick={() => handleSort("location")}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Location</span>
                          {renderSortIcon("location")}
                        </div>
                      </TableHead>
                      <TableHead
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right cursor-pointer select-none hover:text-foreground"
                        onClick={() => handleSort("onHand")}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <span>On Hand</span>
                          {renderSortIcon("onHand")}
                        </div>
                      </TableHead>
                      <TableHead
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right cursor-pointer select-none hover:text-foreground"
                        onClick={() => handleSort("safetyStock")}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <span>Safety Target</span>
                          {renderSortIcon("safetyStock")}
                        </div>
                      </TableHead>
                      <TableHead
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right cursor-pointer select-none hover:text-foreground"
                        onClick={() => handleSort("daysOfSupply")}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <span>Days Supply</span>
                          {renderSortIcon("daysOfSupply")}
                        </div>
                      </TableHead>
                      <TableHead
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right cursor-pointer select-none hover:text-foreground"
                        onClick={() => handleSort("inventoryValue")}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <span>Capital Value</span>
                          {renderSortIcon("inventoryValue")}
                        </div>
                      </TableHead>
                      <TableHead
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center cursor-pointer select-none hover:text-foreground"
                        onClick={() => handleSort("risk")}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <span>Risk Profile</span>
                          {renderSortIcon("risk")}
                        </div>
                      </TableHead>
                      <TableHead
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center cursor-pointer select-none hover:text-foreground"
                        onClick={() => handleSort("status")}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <span>Status</span>
                          {renderSortIcon("status")}
                        </div>
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center pr-4 w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedItems.map((item) => {
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
                          onClick={() => openDrawer(item.id)}
                        >
                          <TableCell className="pl-4 py-3">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-bold text-primary group-hover:underline flex items-center gap-1">
                                  {item.id}
                                </span>
                                {hasAiAction && (
                                  <span className="flex h-1.5 w-1.5 rounded-full bg-primary" title="AI Recommendation Active" />
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground truncate max-w-[210px]">
                                {item.name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-foreground">{item.location}</span>
                              <span className="text-xs text-muted-foreground">{item.category}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-3">
                            <div className="flex flex-col items-end">
                              <span className={`text-sm font-bold tabular-nums ${item.onHand < item.safetyStock ? "text-destructive" : "text-foreground"}`}>
                                {formatNumber(item.onHand)}
                              </span>
                              <span className="text-[10px] text-muted-foreground tabular-nums">
                                {item.bufferCoveragePercent}% of buffer
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-3 text-sm tabular-nums text-muted-foreground font-medium">
                            {formatNumber(item.safetyStock)}
                          </TableCell>
                          <TableCell className="text-right py-3">
                            <span className={`text-sm font-bold tabular-nums inline-block px-1.5 py-0.5 rounded text-xs ${
                              item.daysOfSupply <= 7
                                ? "bg-destructive/15 text-destructive font-bold"
                                : item.daysOfSupply <= 14
                                ? "bg-warning/15 text-warning font-bold"
                                : "text-foreground font-medium"
                            }`}>
                              {item.daysOfSupply}d
                            </span>
                          </TableCell>
                          <TableCell className="text-right py-3 text-sm tabular-nums text-foreground font-medium">
                            {formatCurrency(item.inventoryValue)}
                          </TableCell>
                          <TableCell className="text-center py-3">
                            <Badge className={`capitalize text-xs font-semibold ${getRiskBadge(item.risk)}`}>
                              {item.risk}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center py-3">
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border inline-block ${getStatusColor(item.status)}`}>
                              {getStatusLabel(item.status)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center pr-4 py-3" onClick={(e) => e.stopPropagation()}>
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
                                  onClick={() => openDrawer(item.id)}
                                >
                                  <Eye className="h-3.5 w-3.5 text-primary" />
                                  View SKU Details
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="gap-2 cursor-pointer text-xs font-medium"
                                  onClick={() => openDrawer(item.id)}
                                >
                                  <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                                  View Risk Diagnostics
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="gap-2 cursor-pointer text-xs font-medium"
                                  render={
                                    <Link href="/forecast">
                                      <TrendingUp className="h-3.5 w-3.5 text-primary" />
                                      View Demand Forecast
                                    </Link>
                                  }
                                />
                                <DropdownMenuItem
                                  className="gap-2 cursor-pointer text-xs font-medium"
                                  render={
                                    <Link href="/recommendations">
                                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                                      View Recommendation
                                    </Link>
                                  }
                                />
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="gap-2 cursor-pointer text-xs font-semibold text-primary"
                                  onClick={() => openDrawer(item.id)}
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
                {paginatedItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 flex flex-col gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => openDrawer(item.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="font-mono text-sm font-bold text-primary">{item.id}</span>
                        <span className="text-xs font-medium text-foreground">{item.name}</span>
                      </div>
                      <Badge className={`capitalize text-xs font-semibold ${getRiskBadge(item.risk)}`}>
                        {item.risk}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-2 bg-muted/40 rounded-lg text-center">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground">On Hand</span>
                        <span className={`text-xs font-bold tabular-nums ${item.onHand < item.safetyStock ? "text-destructive" : "text-foreground"}`}>
                          {formatNumber(item.onHand)}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground">Days Supply</span>
                        <span className="text-xs font-bold tabular-nums text-foreground">
                          {item.daysOfSupply}d
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground">Value</span>
                        <span className="text-xs font-bold tabular-nums text-foreground">
                          {formatCurrency(item.inventoryValue)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                      <span>{item.location} &bull; {item.category}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${getStatusColor(item.status)}`}>
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
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(0);
                    }}
                  >
                    {PAGE_SIZES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="tabular-nums font-medium">
                    Page {safeCurrentPage + 1} of {totalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0 cursor-pointer"
                      disabled={safeCurrentPage === 0}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0 cursor-pointer"
                      disabled={safeCurrentPage >= totalPages - 1}
                      onClick={() => setPage((p) => p + 1)}
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
