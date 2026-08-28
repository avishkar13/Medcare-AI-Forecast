"use client";

import { Check, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { QueryErrorInline } from "@/components/ui/query-state";
import { useFormatters } from "@/hooks/use-formatters";
import type { RestockRequest, RestockStatus } from "@/lib/api/movements";

const STATUS_VARIANT: Record<RestockStatus, "outline" | "default" | "destructive" | "secondary"> = {
  REQUESTED: "outline",
  APPROVED: "default",
  REJECTED: "destructive",
  FULFILLED: "secondary",
};

/** What each state means to the person reading the queue, in their terms. */
const STATUS_HINT: Record<RestockStatus, string> = {
  REQUESTED: "Waiting on a decision",
  APPROVED: "Approved — closes when the stock is received",
  REJECTED: "Turned down",
  FULFILLED: "Stock arrived and was recorded",
};

interface RestockTableProps {
  requests: RestockRequest[];
  isPending: boolean;
  isError: boolean;
  canDecide: boolean;
  decidingId: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export function RestockTable({
  requests,
  isPending,
  isError,
  canDecide,
  decidingId,
  onApprove,
  onReject,
}: RestockTableProps) {
  const { formatNumber } = useFormatters();

  if (isError) return <QueryErrorInline label="restock requests" />;
  if (isPending) {
    return <p className="py-6 text-sm text-muted-foreground">Loading restock requests…</p>;
  }

  if (requests.length === 0) {
    return (
      <p className="py-6 text-sm text-muted-foreground">
        No restock requests. One is raised when a planner executes a stockout
        recommendation, or by hand from a DC.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Raised</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>DC</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead>Why</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Decision</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((request) => {
            const deciding = decidingId === request.id;
            // Only REQUESTED is actionable; a decided request answers 409.
            const actionable = request.status === "REQUESTED";

            return (
              <TableRow key={request.id}>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {new Date(request.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-xs">
                  <span className="font-medium">{request.sku}</span>
                  <span className="ml-2 text-muted-foreground">{request.productName}</span>
                </TableCell>
                <TableCell className="text-xs font-medium">{request.warehouseCode}</TableCell>
                <TableCell className="text-right text-xs font-semibold tabular-nums">
                  {formatNumber(request.quantity)}
                </TableCell>
                <TableCell className="max-w-sm text-xs text-muted-foreground">
                  {request.reason ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={STATUS_VARIANT[request.status]}
                    className="text-[10px] font-semibold"
                    title={STATUS_HINT[request.status]}
                  >
                    {request.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {actionable && canDecide ? (
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="xs"
                        className="cursor-pointer gap-1"
                        disabled={deciding}
                        onClick={() => onApprove(request.id)}
                      >
                        {deciding ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        size="xs"
                        className="cursor-pointer gap-1"
                        disabled={deciding}
                        onClick={() => onReject(request.id)}
                      >
                        <X className="h-3 w-3" />
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {actionable ? "View only" : "—"}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
