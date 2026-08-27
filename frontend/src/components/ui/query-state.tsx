"use client";

import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * The pending and failed states of a query, in one place.
 *
 * Before Phase 2, seven of eighty-eight components handled `isError`. The rest fell
 * through to `data?.x ?? 0` and rendered a failed request as a zero - which is
 * indistinguishable from a real zero, and on this product a zero means "no stock at
 * risk" or "no alerts open". A panel that cannot reach the API must say so.
 *
 * Returns `null` for the pending case by default, matching what most panels already
 * did; pass `pending` for a skeleton where the layout shift is worth avoiding.
 */
interface QueryStateProps {
  isPending: boolean;
  isError: boolean;
  /** What could not be loaded, lower-cased: "expiry exposure", "the forecast". */
  label: string;
  pending?: ReactNode;
  children: ReactNode;
}

export function QueryState({
  isPending,
  isError,
  label,
  pending = null,
  children,
}: QueryStateProps) {
  if (isPending) return <>{pending}</>;
  if (isError) return <QueryError label={label} />;
  return <>{children}</>;
}

/** The failed state on its own, for panels that own their pending rendering. */
export function QueryError({ label }: { label: string }) {
  return (
    <Card className="h-full">
      <CardContent className="flex h-full min-h-24 flex-col items-center justify-center gap-2 py-6 text-center">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <p className="text-sm font-medium text-foreground">Could not load {label}</p>
        <p className="text-xs text-muted-foreground">
          The figures here are unavailable, not zero.
        </p>
      </CardContent>
    </Card>
  );
}

/** The same message without the card, for use inside a panel that already has one. */
export function QueryErrorInline({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-sm text-destructive">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>Could not load {label} — unavailable, not zero.</span>
    </div>
  );
}
