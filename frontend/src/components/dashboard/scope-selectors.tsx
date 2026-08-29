"use client";

import { Building2, CalendarRange, X } from "lucide-react";
import { useScope } from "@/hooks/use-scope";
import { useWarehouses } from "@/hooks/use-masterdata";
import { useAuthStore } from "@/store/auth.store";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const HORIZONS = [7, 14, 30, 60, 90];

/**
 * The scope the whole app is read at.
 *
 * This replaced a search input that had no state and no handler. Both selectors write
 * to the URL rather than to local state, so the view they produce is linkable and
 * survives a reload - which is the point of Phase 2.
 *
 * A user assigned to a DC does not get a dropdown. The backend answers `403` for
 * anyone else's warehouse, so offering the choice would only produce an error.
 */
export function ScopeSelectors() {
  const { dc, sku, setSku, horizonDays, setDc, setHorizonDays } = useScope();
  const { data: warehouses, isError } = useWarehouses();
  const confinedTo = useAuthStore((state) => state.user?.warehouseId ?? null);

  const confinedWarehouse = confinedTo
    ? warehouses?.find((warehouse) => warehouse.id === confinedTo)
    : undefined;



  return (
    <div className="hidden md:flex items-center gap-2">
      <div className="flex items-center gap-1.5">
        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
        {confinedTo ? (
          // Not a dropdown: this user has exactly one DC and cannot read another.
          <span className="text-[11px] font-semibold text-foreground px-1">
            {confinedWarehouse?.name ?? confinedWarehouse?.code ?? "Your DC"}
          </span>
        ) : (
          <Select
            value={dc ?? "all"}
            onValueChange={(value) =>
              setDc(!value || value === "all" ? undefined : value)
            }
            disabled={isError}
          >
            <SelectTrigger className="h-8 w-[140px] text-[11px] font-semibold bg-muted/10 border-border/60">
              <span className="truncate">
                {dc && dc !== "all"
                  ? warehouses?.find((w) => w.id === dc)?.name ?? dc
                  : "All DCs"}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All DCs</SelectItem>
              {(warehouses ?? []).map((warehouse) => (
                <SelectItem key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
        <Select
          value={String(horizonDays)}
          onValueChange={(value) => setHorizonDays(Number(value))}
        >
          <SelectTrigger className="h-8 w-[100px] text-[11px] font-semibold bg-muted/10 border-border/60">
            <SelectValue placeholder="Horizon" />
          </SelectTrigger>
          <SelectContent>
            {HORIZONS.map((days) => (
              <SelectItem key={days} value={String(days)}>
                {days} days
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {sku && (
        <Badge 
          variant="secondary" 
          className="ml-2 gap-1 px-2 py-1 text-[11px] font-semibold flex items-center cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors border-border/60"
          onClick={() => setSku(undefined)}
          title="Clear SKU Filter"
        >
          SKU: {sku}
          <X className="h-3 w-3" />
        </Badge>
      )}
    </div>
  );
}
