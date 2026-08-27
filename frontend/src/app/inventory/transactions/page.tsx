"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Bell, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { QueryErrorInline } from "@/components/ui/query-state";
import { RecordMovementDialog } from "@/components/inventory/record-movement-dialog";
import { useMovements } from "@/hooks/use-movements";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useScope } from "@/hooks/use-scope";
import { useFormatters } from "@/hooks/use-formatters";
import { MOVEMENT_TYPES } from "@/lib/api/movements";

const selectClass =
  "h-8 rounded-md border border-input bg-background px-2 text-xs font-medium shadow-sm " +
  "outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring cursor-pointer";

/**
 * The ledger. Phase 3.7.
 *
 * `sku-detail-drawer.tsx` used to hardcode `movements: [] as never[]` with the comment
 * "no movement ledger exists". It does now, and this is where it is read.
 */
export default function TransactionsPage() {
  return (
    <Suspense
      fallback={<p className="p-6 text-sm text-muted-foreground">Loading transactions…</p>}
    >
      <TransactionsView />
    </Suspense>
  );
}

function TransactionsView() {
  const { withScope } = useScope();
  const { formatNumber } = useFormatters();

  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const debouncedSearch = useDebouncedValue(search);

  const { data, isPending, isError, isFetching, refetch } = useMovements({
    ...(debouncedSearch ? { sku: debouncedSearch } : {}),
    ...(type === "all" ? {} : { type }),
    pageSize: 100,
  });

  const rows = data?.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col">
      <div className="mb-6 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            Every movement of stock, newest first. Recording one changes stock and re-runs
            alert detection.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2 cursor-pointer"
            onClick={() => void refetch()}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <RecordMovementDialog />
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Filter by SKU…"
              className="h-8 max-w-xs text-sm"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              className={selectClass}
              value={type}
              onChange={(event) => setType(event.target.value)}
              aria-label="Movement type"
            >
              <option value="all">All types</option>
              {MOVEMENT_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <span className="ml-auto text-xs text-muted-foreground">
              {data?.meta.total ?? 0} movements
            </span>
          </div>

          {isError ? (
            <QueryErrorInline label="the movement ledger" />
          ) : isPending ? (
            <p className="py-6 text-sm text-muted-foreground">Loading transactions…</p>
          ) : rows.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              No movements yet. Recording one is what starts the ledger.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>DC</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Before</TableHead>
                    <TableHead className="text-right">After</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const outward = row.quantity < 0;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(row.date).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs font-medium">{row.dc}</TableCell>
                        <TableCell className="text-xs">
                          <Link
                            href={withScope("/inventory", { sku: row.sku })}
                            className="font-medium hover:underline"
                          >
                            {row.sku}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-semibold">
                            {row.movementType.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={`text-right text-xs font-semibold ${
                            outward ? "text-destructive" : "text-success"
                          }`}
                        >
                          <span className="inline-flex items-center gap-1">
                            {outward ? (
                              <ArrowDownRight className="h-3 w-3" />
                            ) : (
                              <ArrowUpRight className="h-3 w-3" />
                            )}
                            {formatNumber(Math.abs(row.quantity))}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {formatNumber(row.stockBefore)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-medium">
                          {formatNumber(row.stockAfter)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.reference ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.userOrSystem ?? "system"}
                        </TableCell>
                        <TableCell>
                          {/* "This transaction caused this alert" as a real link. */}
                          {row.triggeredAlertId ? (
                            <Link
                              href={withScope("/alerts", { sku: row.sku, dc: row.warehouseId })}
                              title="This movement raised an alert"
                              className="inline-flex items-center text-warning hover:underline"
                            >
                              <Bell className="h-3.5 w-3.5" />
                            </Link>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
