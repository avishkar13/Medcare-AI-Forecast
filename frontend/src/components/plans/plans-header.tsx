"use client";

import Link from "next/link";
import { ArrowRight, RefreshCw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PlansHeaderProps {
  planningRunId: string | null;
  isFetching: boolean;
  onRefresh: () => void;
}

export function PlansHeader({ planningRunId, isFetching, onRefresh }: PlansHeaderProps) {
  return (
    <div className="mb-2 flex flex-col justify-between gap-4 pt-4 sm:pt-6 md:flex-row md:items-end">
      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-ai">
          Plan the right supply
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Supply &amp; Transfers</h1>
        <p className="mt-1 max-w-2xl text-sm font-medium text-muted-foreground">
          What the planner proposes for the current run: replenishment orders per DC and
          the inter-DC transfers that cover shortages before they need one. Approving a
          plan records intent — it does not move stock.
        </p>
      </div>

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center md:gap-4">
        {planningRunId ? (
          <p className="whitespace-nowrap text-[11px] font-semibold text-muted-foreground">
            Run <span className="font-mono">{planningRunId.slice(-8)}</span>
          </p>
        ) : null}

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 cursor-pointer gap-2 bg-background text-xs font-semibold"
            onClick={onRefresh}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Link
            href="/dashboard"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-8 gap-2 bg-background text-xs font-semibold",
            )}
          >
            Run the planner
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
