"use client";

import { useMemo, useState } from "react";
import { RotateCcw, Save, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { usePlanningParameters, useUpsertParameters } from "@/hooks/use-parameters";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useSettings } from "@/hooks/use-settings";
import { useWarehouses } from "@/hooks/use-masterdata";
import { useUiStore } from "@/store/ui.store";
import type { PlanningParameter } from "@/lib/api/parameters";

const selectClass =
  "h-8 rounded-md border border-input bg-background px-2 text-xs font-medium shadow-sm " +
  "outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring cursor-pointer";

/** The three overridable fields, named once so the row helpers stay in step. */
type Field = "stockout" | "expiry" | "minimum";

type Edits = Record<string, Record<Field, string>>;

/** Where each field's stored value lives on the row, so lookups are not restated. */
const STORED: Record<Field, (row: PlanningParameter) => number | null> = {
  stockout: (row) => row.alertStockoutProbability,
  expiry: (row) => row.alertExpiryWindowDays,
  minimum: (row) => row.minimumStockUnits,
};

const asText = (value: number | null) => (value === null ? "" : String(value));

/**
 * Alert thresholds per SKU and DC.
 *
 * A single global number governed all 160 positions, so a critical antibiotic at a
 * Tier-2 DC with a fortnight of lead time was judged by whatever suited a routine
 * analgesic at a metro DC. These override that per item-location; an empty field
 * inherits, which is the normal state and is shown as such rather than as a blank.
 */
export function ThresholdSettings() {
  const [search, setSearch] = useState("");
  const [warehouse, setWarehouse] = useState("all");
  const debounced = useDebouncedValue(search);

  const { data: warehouses } = useWarehouses();
  const { data: settings } = useSettings();
  const upsert = useUpsertParameters();

  /**
   * The top bar owns scope app-wide, and `usePlanningParameters` applies it over
   * anything passed here. Without this the selector below would silently do nothing
   * whenever a DC was chosen up there - a control that looks live and is not.
   */
  const scopedDc = useUiStore((state) => state.dc);
  const dcLocked = Boolean(scopedDc);

  const { data, isPending, isError } = usePlanningParameters({
    ...(debounced ? { sku: debounced } : {}),
    ...(warehouse === "all" ? {} : { warehouse }),
    pageSize: 200,
  });

  const [edits, setEdits] = useState<Edits>({});

  const globals = settings?.alerts.thresholds;
  const rows = useMemo(() => data?.data ?? [], [data]);

  const valueOf = (row: PlanningParameter, field: Field): string => {
    const edit = edits[row.id]?.[field];
    return edit !== undefined ? edit : asText(STORED[field](row));
  };

  const setEdit = (row: PlanningParameter, field: Field, value: string) =>
    setEdits((prev) => ({
      ...prev,
      [row.id]: {
        stockout: prev[row.id]?.stockout ?? asText(STORED.stockout(row)),
        expiry: prev[row.id]?.expiry ?? asText(STORED.expiry(row)),
        minimum: prev[row.id]?.minimum ?? asText(STORED.minimum(row)),
        [field]: value,
      },
    }));

  const isDirty = (row: PlanningParameter) => {
    const edit = edits[row.id];
    if (!edit) return false;
    return (Object.keys(STORED) as Field[]).some(
      (field) => edit[field] !== asText(STORED[field](row)),
    );
  };

  /** Empty means inherit, so it is sent as null rather than skipped or coerced to zero. */
  const toOverride = (raw: string): number | null => {
    const trimmed = raw.trim();
    if (trimmed === "") return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const save = async (row: PlanningParameter) => {
    const edit = edits[row.id];
    if (!edit) return;

    const stockout = toOverride(edit.stockout);
    const expiry = toOverride(edit.expiry);
    const minimum = toOverride(edit.minimum);

    if (stockout !== null && (stockout < 0 || stockout > 100)) {
      toast.error("Stockout probability must be between 0 and 100%");
      return;
    }
    if (expiry !== null && (expiry < 1 || expiry > 365)) {
      toast.error("Expiry window must be between 1 and 365 days");
      return;
    }
    if (minimum !== null && minimum < 0) {
      toast.error("Minimum stock cannot be negative");
      return;
    }

    // The route upserts the whole row, so every planning value is carried through
    // unchanged - editing a threshold must not silently reset a lead time.
    await upsert.mutateAsync({
      sku: row.sku,
      warehouse: row.warehouseCode,
      leadTimeDays: row.leadTimeDays,
      leadTimeStdDev: row.leadTimeStdDev,
      serviceLevel: row.serviceLevel,
      reviewPeriodDays: row.reviewPeriodDays,
      minimumOrderQty: row.minimumOrderQty,
      maximumInventory: row.maximumInventory,
      holdingCostPerUnit: row.holdingCostPerUnit,
      stockoutCostPerUnit: row.stockoutCostPerUnit,
      expiryCostPerUnit: row.expiryCostPerUnit,
      alertStockoutProbability: stockout,
      alertExpiryWindowDays: expiry,
      minimumStockUnits: minimum,
    });

    setEdits((prev) => {
      const next = { ...prev };
      delete next[row.id];
      return next;
    });

    const describe = (value: number | null, unit: string, fallback: number | undefined) =>
      value === null ? `inherited (${fallback ?? "—"}${unit})` : `${value}${unit}`;

    toast.success(`${row.sku} at ${row.warehouseCode} updated`, {
      description: `Stockout ${describe(stockout, "%", globals?.stockoutProbability)} · Expiry ${describe(expiry, "d", globals?.expiryWindow)} · Minimum ${minimum === null ? "off" : `${minimum} units`}. Applies from the next detection cycle.`,
    });
  };

  const clearRow = (row: PlanningParameter) =>
    setEdits((prev) => ({ ...prev, [row.id]: { stockout: "", expiry: "", minimum: "" } }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold text-foreground">Alert Thresholds by SKU</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Override the global thresholds for a single product at a single DC. Leave a field
          empty to inherit — most positions should. Changes apply from the next detection
          cycle.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter by SKU…"
            className="h-8 pl-8 text-sm"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <select
          className={selectClass}
          value={dcLocked ? "all" : warehouse}
          onChange={(event) => setWarehouse(event.target.value)}
          disabled={dcLocked}
          title={dcLocked ? "Scoped by the DC selector in the top bar" : undefined}
          aria-label="Distribution centre"
        >
          <option value="all">{dcLocked ? "Scoped by top bar" : "All DCs"}</option>
          {(warehouses ?? []).map((row) => (
            <option key={row.id} value={row.code}>
              {row.name}
            </option>
          ))}
        </select>
        <span className="ml-auto text-xs text-muted-foreground">
          Global: {globals?.stockoutProbability ?? "—"}% stockout · {globals?.expiryWindow ?? "—"}{" "}
          day expiry window
        </span>
      </div>

      {isError ? (
        <QueryErrorInline label="planning parameters" />
      ) : isPending ? (
        <p className="py-6 text-sm text-muted-foreground">Loading parameters…</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">No positions match that filter.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>DC</TableHead>
                <TableHead className="text-right">Lead time</TableHead>
                <TableHead className="w-[150px]">Stockout probability</TableHead>
                <TableHead className="w-[150px]">Expiry window</TableHead>
                <TableHead className="w-[150px]">Minimum stock</TableHead>
                <TableHead className="w-[130px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-xs font-medium">
                    {row.sku}
                    <span className="block text-[10px] text-muted-foreground">
                      {row.productName}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">{row.warehouseCode}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                    {row.leadTimeDays}d
                  </TableCell>

                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      className="h-8 text-right text-xs"
                      placeholder={`Inherited (${globals?.stockoutProbability ?? "—"}%)`}
                      value={valueOf(row, "stockout")}
                      onChange={(event) => setEdit(row, "stockout", event.target.value)}
                    />
                  </TableCell>

                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      className="h-8 text-right text-xs"
                      placeholder={`Inherited (${globals?.expiryWindow ?? "—"}d)`}
                      value={valueOf(row, "expiry")}
                      onChange={(event) => setEdit(row, "expiry", event.target.value)}
                    />
                  </TableCell>

                  <TableCell>
                    {/*
                      No global to fall back on, so the placeholder says the rule is off
                      rather than naming a value it would inherit.
                    */}
                    <Input
                      type="number"
                      min={0}
                      className="h-8 text-right text-xs"
                      placeholder="Off"
                      value={valueOf(row, "minimum")}
                      onChange={(event) => setEdit(row, "minimum", event.target.value)}
                    />
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {(row.alertStockoutProbability !== null ||
                        row.alertExpiryWindowDays !== null ||
                        row.minimumStockUnits !== null ||
                        isDirty(row)) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[10px] font-semibold text-muted-foreground"
                          onClick={() => clearRow(row)}
                          title="Clear both overrides and inherit the global values"
                        >
                          <RotateCcw className="mr-1 h-3 w-3" />
                          Inherit
                        </Button>
                      )}
                      <Button
                        size="sm"
                        className="h-7 px-2 text-[10px] font-semibold"
                        disabled={!isDirty(row) || upsert.isPending}
                        onClick={() => void save(row)}
                      >
                        <Save className="mr-1 h-3 w-3" />
                        Save
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
