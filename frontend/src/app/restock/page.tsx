"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, RefreshCw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RestockTable } from "@/components/restock/restock-table";
import { useRestockActions, useRestockRequests } from "@/hooks/use-movements";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useAuthStore } from "@/store/auth.store";
import { cn } from "@/lib/utils";

const selectClass =
  "h-8 rounded-md border border-input bg-background px-2 text-xs font-medium shadow-sm " +
  "outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring cursor-pointer";

const ALL = "all";

/**
 * The restock queue.
 *
 * `POST /api/restock-requests`, its two decisions and the whole
 * REQUESTED -> APPROVED -> FULFILLED lifecycle have existed with a typed client and
 * hooks and no screen at all, so the one place a planner could ask for stock was a
 * curl. This is that screen.
 *
 * Deciding records intent; it moves nothing. A request reaches FULFILLED only when the
 * arriving movement is recorded against it, which is the same boundary the planning
 * executor respects.
 */
export default function RestockPage() {
  const canDecide = useAuthStore((state) => state.hasPermission("inventory:adjust"));

  const [status, setStatus] = useState(ALL);
  const [sku, setSku] = useState("");
  const debouncedSku = useDebouncedValue(sku);

  const query = useRestockRequests({
    ...(status === ALL ? {} : { status }),
    ...(debouncedSku ? { sku: debouncedSku } : {}),
    pageSize: 100,
  });

  const { approve, reject } = useRestockActions();

  // One row at a time, so only the row being decided shows a spinner.
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const decide = (id: string, action: "approve" | "reject") => {
    setDecidingId(id);
    const mutation = action === "approve" ? approve : reject;

    mutation.mutate(id, {
      onSuccess: () => toast.success(`Request ${action}d`),
      // A request decided in another tab answers 409, and one belonging to another DC
      // answers 404. Both are information, not a crash.
      onError: (error: Error) =>
        toast.error(`Could not ${action} the request`, { description: error.message }),
      onSettled: () => setDecidingId(null),
    });
  };

  const requests = query.data?.data ?? [];
  const waiting = requests.filter((request) => request.status === "REQUESTED").length;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 pb-10">
      <div className="mb-2 flex flex-col justify-between gap-4 pt-4 sm:pt-6 md:flex-row md:items-end">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-ai">
            Execute &amp; update
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Restock Requests</h1>
          <p className="mt-1 max-w-2xl text-sm font-medium text-muted-foreground">
            Stock a DC has asked for, and what was decided. Approving records the
            decision — the request closes when the arriving stock is recorded as a
            movement.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center md:gap-4">
          {waiting > 0 ? (
            <p className="whitespace-nowrap text-[11px] font-semibold text-muted-foreground">
              {waiting} awaiting a decision
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 cursor-pointer gap-2 bg-background text-xs font-semibold"
              onClick={() => void query.refetch()}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            {/* Where an approved request is closed out, so the loop is walkable. */}
            <Link
              href="/inventory/transactions"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "h-8 gap-2 bg-background text-xs font-semibold",
              )}
            >
              Record a movement
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Filter by SKU…"
              className="h-8 max-w-xs text-sm"
              value={sku}
              onChange={(event) => setSku(event.target.value)}
            />
            <select
              className={selectClass}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label="Request status"
            >
              <option value={ALL}>All statuses</option>
              <option value="REQUESTED">Requested</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="FULFILLED">Fulfilled</option>
            </select>
            <span className="ml-auto text-xs text-muted-foreground">
              {query.data?.meta.total ?? 0} requests
            </span>
          </div>

          <RestockTable
            requests={requests}
            isPending={query.isPending}
            isError={query.isError}
            canDecide={canDecide}
            decidingId={decidingId}
            onApprove={(id) => decide(id, "approve")}
            onReject={(id) => decide(id, "reject")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
