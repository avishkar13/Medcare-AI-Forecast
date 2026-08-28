"use client";

import { useState } from "react";

import { ArrowRight, Check, Loader2, X } from "lucide-react";
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
import type { DrpPlan, PlanStatus } from "@/lib/api/plans";

const STATUS_VARIANT: Record<PlanStatus, "outline" | "default" | "destructive"> = {
  PROPOSED: "outline",
  APPROVED: "default",
  REJECTED: "destructive",
};

interface DrpPlanTableProps {
  plans: DrpPlan[];
  isPending: boolean;
  isError: boolean;
  canDecide: boolean;
  decidingId: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export function DrpPlanTable({
  plans,
  isPending,
  isError,
  canDecide,
  decidingId,
  onApprove,
  onReject,
}: DrpPlanTableProps) {
  const { formatNumber } = useFormatters();
  const [currentPage, setCurrentPage] = useState(1);

  if (isError) return <QueryErrorInline label="transfer plans" />;
  if (isPending) return <p className="py-6 text-sm text-muted-foreground">Loading transfers…</p>;

  if (plans.length === 0) {
    return (
      <p className="py-6 text-sm text-muted-foreground">
        No transfers proposed. The planner only moves stock between DCs when one is short
        and another is holding above its maximum.
      </p>
    );
  }

  const pageSize = 15;
  const maxPage = Math.max(1, Math.ceil(plans.length / pageSize));
  const safePage = Math.min(currentPage, maxPage);
  const displayPlans = plans.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Lane</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead>Why</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Decision</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayPlans.map((plan) => {
              const deciding = decidingId === plan.id;
              const actionable = plan.status === "PROPOSED";

              return (
                <TableRow key={plan.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(plan.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-xs">
                  <span className="font-medium">{plan.sku}</span>
                  <span className="ml-2 text-muted-foreground">{plan.productName}</span>
                </TableCell>
                <TableCell className="text-xs">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    {plan.fromWarehouseCode}
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    {plan.toWarehouseCode}
                  </span>
                </TableCell>
                <TableCell className="text-right text-xs font-semibold tabular-nums">
                  {formatNumber(plan.quantity)}
                </TableCell>
                <TableCell className="max-w-sm text-xs text-muted-foreground">
                  {plan.reason ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={STATUS_VARIANT[plan.status]}
                    className="text-[10px] font-semibold"
                  >
                    {plan.status}
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
                        onClick={() => onApprove(plan.id)}
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
                        onClick={() => onReject(plan.id)}
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
      {maxPage > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-muted-foreground">
            Showing {(safePage - 1) * pageSize + 1} to {Math.min(safePage * pageSize, plans.length)} of {plans.length} entries
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs cursor-pointer"
              disabled={safePage === 1}
              onClick={() => setCurrentPage(safePage - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs cursor-pointer"
              disabled={safePage === maxPage}
              onClick={() => setCurrentPage(safePage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
