"use client";

import { Suspense, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { ExportButton } from "@/components/ui/export-button";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/config/query-keys";
import { useInventory } from "@/hooks/use-inventory";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useScope } from "@/hooks/use-scope";
import { useProducts, useWarehouses } from "@/hooks/use-masterdata";
import { InventoryKpiCards } from "@/components/inventory/inventory-kpi-cards";
import { InventoryHealth } from "@/components/inventory/inventory-health";
import { InventoryNetwork } from "@/components/inventory/inventory-network";
import { InventoryFilters } from "@/components/inventory/inventory-filters";
import { InventoryTable } from "@/components/inventory/inventory-table";
import type { InventorySort } from "@/components/inventory/inventory-table";
import type { InventoryTableItem } from "@/types/inventory";

/**
 * `useScope` reads `useSearchParams`, which opts a route out of static rendering
 * unless it sits behind a Suspense boundary. Kept in a child so the shell still
 * prerenders - the same split `app/alerts/page.tsx` uses.
 */
export default function InventoryPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading inventory…</p>}>
      <InventoryView />
    </Suspense>
  );
}

function InventoryView() {
  const client = useQueryClient();
  const { dc, withScope } = useScope();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [location, setLocation] = useState("all");
  const [status, setStatus] = useState("all");
  const [risk, setRisk] = useState("all");

  /**
   * Paging and sorting are server concerns, so they live here alongside the filters
   * rather than inside the table. The table used to sort and slice whatever had
   * already arrived, which meant "top 10 by risk" only ever ranked the first page.
   */
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<InventorySort>("risk");

  // One request per settled search term rather than one per keystroke.
  const debouncedSearch = useDebouncedValue(search);

  /**
   * Narrowing happens on the server.
   *
   * The DC from the URL wins over the location dropdown: the top bar is the scope the
   * whole app is read at, and a page-level control must not silently leave it.
   */
  const filters = useMemo(
    () => ({
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(category === "all" ? {} : { category }),
      ...(dc ? { warehouse: dc } : location === "all" ? {} : { warehouse: location }),
      ...(status === "all" ? {} : { status }),
      ...(risk === "all" ? {} : { risk }),
    }),
    [debouncedSearch, category, dc, location, status, risk],
  );

  /**
   * A narrowed result set is shorter, so the page the reader was on may no longer
   * exist. Going back to the first page is the only reading that cannot show an empty
   * table over a non-empty result.
   *
   * Adjusted during render rather than in an effect: the debounced search settles
   * without a user event to hang a handler on, and an effect here would render the
   * stale page once before correcting itself.
   */
  const resetKey = JSON.stringify([filters, pageSize, sort]);
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  if (lastResetKey !== resetKey) {
    setLastResetKey(resetKey);
    setPage(1);
  }

  const { data, isPending, isError, isFetching } = useInventory({
    ...filters,
    sort,
    page,
    pageSize,
  });

  const items: InventoryTableItem[] = useMemo(
    () =>
      (data?.items ?? []).map((row) => ({
        // One product at one warehouse. The SKU alone collides across DCs.
        id: `${row.productId}:${row.warehouseId}`,
        sku: row.sku,
        name: row.productName,
        category: row.category,
        location: row.warehouseName,
        onHand: row.onHand,
        reserved: row.reserved,
        inTransit: row.inTransit,
        available: row.available,
        safetyStock: row.safetyStock,
        reorderPoint: row.reorderPoint,
        daysOfSupply: row.daysOfSupply,
        unitValue: row.unitCost,
        inventoryValue: row.inventoryValue,
        bufferCoveragePercent: row.bufferCoveragePercent,
        risk: row.risk,
        status: row.status as InventoryTableItem["status"],
      })),
    [data],
  );

  /**
   * Filter options come from master data, not from the rows on screen.
   *
   * Deriving them from the response worked only while the response was the whole
   * network; now that the server narrows, the options would collapse to whatever
   * survived the current filter and there would be no way back.
   */
  const { data: products } = useProducts();
  const { data: warehouses } = useWarehouses();

  // `category` is nullable, and an uncategorised product has nothing to filter on.
  const categories = useMemo(
    () => [
      ...new Set(
        (products ?? [])
          .map((product) => product.category)
          .filter((category): category is string => Boolean(category)),
      ),
    ],
    [products],
  );
  const locations = useMemo(
    () => {
      if (!warehouses) return [];
      if (dc) {
        const match = warehouses.find((w) => w.id === dc);
        return match ? [match.name] : [];
      }
      return warehouses.map((warehouse) => warehouse.name);
    },
    [warehouses, dc],
  );

  const lastUpdated = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const resetFilters = () => {
    setSearch("");
    setCategory("all");
    setLocation("all");
    setStatus("all");
    setRisk("all");
  };

  return (
    <div className="flex flex-col w-full max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border mb-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Monitor stock levels, inventory health, and replenishment readiness across the network.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-medium" suppressHydrationWarning>
            Last updated: {lastUpdated}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2 cursor-pointer"
            onClick={() => void client.invalidateQueries({ queryKey: queryKeys.inventory.all })}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
          {/* E1 output 2: the item-wise stock view, narrowed exactly as the table is. */}
          <ExportButton
            path="/inventory/export"
            fallbackName="item-wise-stock-view.csv"
            label="stock positions"
            params={filters}
          />
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/*
          Totals come from the same response as the rows, so the headline figures and
          the table can never disagree. These used to be a second, unfiltered request:
          the table narrowed to one DC while the cards above still read the network.
        */}
        <InventoryKpiCards totals={data?.totals} isPending={isPending} isError={isError} />

        <div className="grid [&>*]:min-w-0 grid-cols-1 lg:grid-cols-2 gap-6">
          <InventoryHealth warehouseId={dc} />
          <InventoryNetwork />
        </div>

        {isPending ? (
          <p className="text-sm text-muted-foreground py-6">Loading inventory…</p>
        ) : isError ? (
          <p className="text-sm text-destructive py-6">
            Could not load inventory. The figures below are unavailable, not zero.
          </p>
        ) : null}

        <InventoryFilters
          search={search}
          onSearchChange={setSearch}
          category={category}
          onCategoryChange={setCategory}
          location={location}
          onLocationChange={setLocation}
          status={status}
          onStatusChange={setStatus}
          risk={risk}
          onRiskChange={setRisk}
          categories={categories}
          locations={locations}
          onReset={resetFilters}
          dcLocked={Boolean(dc)}
        />

        <InventoryTable
          items={items}
          total={data?.meta.total ?? 0}
          page={page}
          pageSize={pageSize}
          sort={sort}
          isFetching={isFetching}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          onSortChange={setSort}
          onResetFilters={resetFilters}
          withScope={withScope}
        />
      </div>
    </div>
  );
}
