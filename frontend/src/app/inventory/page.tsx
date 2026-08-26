"use client";

import { useState, useMemo } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInventory } from "@/hooks/use-inventory";
import { InventoryKpiCards } from "@/components/inventory/inventory-kpi-cards";
import { InventoryHealth } from "@/components/inventory/inventory-health";
import { InventoryNetwork } from "@/components/inventory/inventory-network";
import { InventoryFilters } from "@/components/inventory/inventory-filters";
import { InventoryTable } from "@/components/inventory/inventory-table";
import type { InventoryTableItem } from "@/types/inventory";

export default function InventoryPage() {
  const { data, isPending, isError } = useInventory();

  // a position is one product at one warehouse, so the row id has to be both.
  const allItems: InventoryTableItem[] = useMemo(
    () =>
      (data?.items ?? []).map((row) => ({
        id: row.sku,
        name: row.productName,
        category: row.category,
        location: row.warehouseName,
        onHand: row.onHand,
        safetyStock: row.safetyStock,
        reorderPoint: row.reorderPoint,
        daysOfSupply: row.daysOfSupply,
        unitValue: row.unitCost,
        inventoryValue: row.inventoryValue,
        risk: row.risk as InventoryTableItem["risk"],
        status: row.status as InventoryTableItem["status"],
      })),
    [data],
  );

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [location, setLocation] = useState("all");
  const [status, setStatus] = useState("all");
  const [risk, setRisk] = useState("all");

  const filteredItems = useMemo(() => {
    return allItems.filter((item: InventoryTableItem) => {
      const matchSearch =
        !search ||
        item.id.toLowerCase().includes(search.toLowerCase()) ||
        item.name.toLowerCase().includes(search.toLowerCase());
      const matchCategory = category === "all" || item.category === category;
      const matchLocation = location === "all" || item.location === location;
      const matchStatus = status === "all" || item.status === status;
      const matchRisk = risk === "all" || item.risk === risk;
      return matchSearch && matchCategory && matchLocation && matchStatus && matchRisk;
    });
  }, [allItems, search, category, location, status, risk]);

  const categories = [...new Set(allItems.map((i: InventoryTableItem) => i.category))];
  const locations = [...new Set(allItems.map((i: InventoryTableItem) => i.location))];
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
          <Button variant="outline" size="sm" className="h-8 gap-2 cursor-pointer">
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <InventoryKpiCards />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <InventoryHealth />
          <InventoryNetwork />
        </div>

      {isPending ? (
        <p className="text-sm text-muted-foreground py-6">Loading inventory…</p>
      ) : isError ? (
        <p className="text-sm text-muted-foreground py-6">Could not load inventory.</p>
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
        />

        <InventoryTable items={filteredItems} onResetFilters={resetFilters} />
      </div>
    </div>
  );
}
