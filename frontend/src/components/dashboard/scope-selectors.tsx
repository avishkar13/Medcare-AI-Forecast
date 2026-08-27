"use client";

import { Building2, CalendarRange } from "lucide-react";
import { useScope } from "@/hooks/use-scope";
import { useWarehouses } from "@/hooks/use-masterdata";
import { useAuthStore } from "@/store/auth.store";

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
  const { dc, horizonDays, setDc, setHorizonDays } = useScope();
  const { data: warehouses, isError } = useWarehouses();
  const confinedTo = useAuthStore((state) => state.user?.warehouseId ?? null);

  const confinedWarehouse = confinedTo
    ? warehouses?.find((warehouse) => warehouse.id === confinedTo)
    : undefined;

  const selectClass =
    "h-8 rounded-md border bg-muted/10 px-2 text-[11px] font-semibold outline-none " +
    "transition-colors focus:ring-1 focus:ring-primary/30 cursor-pointer " +
    "border-border/60 text-foreground";

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
          <select
            aria-label="Distribution centre"
            className={selectClass}
            value={dc ?? "all"}
            onChange={(event) =>
              setDc(event.target.value === "all" ? undefined : event.target.value)
            }
            disabled={isError}
          >
            <option value="all">All DCs</option>
            {(warehouses ?? []).map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
        <select
          aria-label="Horizon in days"
          className={selectClass}
          value={horizonDays}
          onChange={(event) => setHorizonDays(Number(event.target.value))}
        >
          {HORIZONS.map((days) => (
            <option key={days} value={days}>
              {days} days
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
