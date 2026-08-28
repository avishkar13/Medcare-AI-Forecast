"use client";

import { Radio } from "lucide-react";
import { useDcSync } from "@/hooks/use-movements";

/**
 * Whether a DC is actually reporting.
 *
 * `GET /api/dc/:code/sync` and `useDcSync` both existed with no caller, so the one
 * question the ledger cannot answer from its own rows - "is this silence because
 * nothing moved, or because the DC stopped talking to us?" - had no surface.
 *
 * Renders nothing network-wide: "last synced" is a property of a single site, and an
 * aggregate of four DCs' clocks would mean nothing.
 */
const TONE = {
  live: { dot: "bg-success", label: "Live" },
  stale: { dot: "bg-warning", label: "Stale" },
  never: { dot: "bg-destructive", label: "Never reported" },
} as const;

export function DcSyncStatus({ dcCode }: { dcCode?: string }) {
  const { data, isPending, isError } = useDcSync(dcCode);

  if (!dcCode || isPending || isError || !data) return null;

  const tone = TONE[data.status];

  return (
    <div className="flex items-center gap-2 rounded-full border border-border/50 bg-background px-3 py-1.5 shadow-sm">
      <Radio className="h-3 w-3 text-muted-foreground" />
      <span className="relative flex h-2 w-2">
        {data.status === "live" && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${tone.dot} opacity-75`} />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${tone.dot}`} />
      </span>
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {data.code} {tone.label}
        {data.minutesSinceSync === null ? "" : ` · ${data.minutesSinceSync}m ago`}
      </span>
      <span className="text-[10px] font-medium text-muted-foreground">
        {data.movementsToday} today
      </span>
    </div>
  );
}
