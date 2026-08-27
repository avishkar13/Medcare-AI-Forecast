"use client";

import { useState } from "react";
import { ProjectionChart } from "@/components/charts/projection-chart";
import { useCompletedRuns } from "@/hooks/use-planning";
import { useProducts, useWarehouses } from "@/hooks/use-masterdata";
import { useScope } from "@/hooks/use-scope";

const selectClass =
  "h-8 rounded-md border border-input bg-background px-2 text-xs font-medium shadow-sm " +
  "outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring cursor-pointer";

/**
 * Picks the position whose projection to draw, then draws it.
 *
 * The chart itself takes a run and a position and nothing else; choosing them is this
 * component's job so the chart stays reusable on the cell page Phase 4 builds.
 *
 * The SKU comes from the URL when a link supplied one - arriving from an alert or a
 * ledger row lands on that SKU's curve rather than on an empty picker.
 */
export function PositionProjection() {
  const { dc, dcCode, sku: urlSku } = useScope();
  const { data: runs } = useCompletedRuns(1);
  const { data: products } = useProducts();
  const { data: warehouses } = useWarehouses();

  const [sku, setSku] = useState<string | undefined>(undefined);
  const [warehouse, setWarehouse] = useState<string | undefined>(undefined);

  const runId = runs?.data?.[0]?.id ?? null;
  const effectiveSku = sku ?? urlSku;
  const effectiveWarehouse =
    warehouse ?? dcCode ?? warehouses?.find((row) => row.id === dc)?.code;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Projection
        </span>
        <select
          className={selectClass}
          value={effectiveSku ?? ""}
          onChange={(event) => setSku(event.target.value || undefined)}
          aria-label="SKU"
        >
          <option value="">Select a SKU…</option>
          {(products ?? []).map((row) => (
            <option key={row.id} value={row.sku}>
              {row.sku} — {row.name}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={effectiveWarehouse ?? ""}
          onChange={(event) => setWarehouse(event.target.value || undefined)}
          aria-label="Distribution centre"
        >
          <option value="">Select a DC…</option>
          {(warehouses ?? []).map((row) => (
            <option key={row.id} value={row.code}>
              {row.name}
            </option>
          ))}
        </select>
      </div>

      <ProjectionChart
        runId={runId}
        {...(effectiveSku ? { sku: effectiveSku } : {})}
        {...(effectiveWarehouse ? { warehouse: effectiveWarehouse } : {})}
      />
    </div>
  );
}
