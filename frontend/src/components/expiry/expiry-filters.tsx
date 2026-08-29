"use client";

import { useWarehouses } from "@/hooks/use-masterdata";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, RotateCcw, ArrowUpDown } from "lucide-react";

interface ExpiryFiltersProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filters: any;
  updateFilter: (key: string, value: string) => void;
  onReset: () => void;
  selectedDcId?: string;
}

export function ExpiryFilters({ filters, updateFilter, onReset, selectedDcId }: ExpiryFiltersProps) {
  const { data: warehouses } = useWarehouses();

  const selectedWarehouse = warehouses?.find(w => w.id === selectedDcId);
  const displayLocation = selectedWarehouse ? selectedWarehouse.name : filters.location;

  const hasActiveFilters = 
    filters.search !== "" || 
    filters.window !== "all" || 
    filters.risk !== "all" || 
    filters.category !== "all" || 
    filters.location !== "all" || 
    filters.status !== "all";

  return (
    <div className="bg-background border border-border/60 rounded-xl p-3 shadow-sm flex flex-col gap-3 mb-6 transition-all hover:shadow-md">
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground opacity-70" />
          <Input
            placeholder="Search SKU, product, batch, location..."
            className="pl-9 h-9 text-xs font-medium bg-muted/10 border-border/50 hover:border-border/80 focus-visible:ring-1 focus-visible:ring-primary/30 transition-all rounded-lg"
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-9 px-3 text-[11px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all rounded-lg" onClick={onReset}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Reset
            </Button>
          )}
          <div className="flex items-center gap-2 border border-border/50 rounded-lg px-2.5 bg-muted/5 h-9 hover:bg-muted/20 hover:border-border/80 transition-all cursor-pointer">
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground opacity-70" />
            <select
              className="bg-transparent text-[11px] font-bold uppercase tracking-wider outline-none text-foreground pr-2 cursor-pointer appearance-none"
              value={filters.sortBy}
              onChange={(e) => updateFilter("sortBy", e.target.value)}
            >
              <option value="earliest_expiry">Earliest Expiry</option>
              <option value="highest_value">Highest Value</option>
              <option value="highest_quantity">Highest Quantity</option>
              <option value="highest_waste">Highest Waste Risk</option>
              <option value="demand_coverage">Demand Coverage</option>
            </select>
          </div>
        </div>
      </div>

      {/* Select Filters Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <select
          className={`h-8 px-2.5 py-0 border rounded-lg text-[10px] font-bold uppercase tracking-wider outline-none focus:ring-1 focus:ring-primary/30 cursor-pointer transition-all hover:brightness-95 ${filters.window !== 'all' ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted/10 border-border/50 text-muted-foreground hover:border-border/80'}`}
          value={filters.window}
          onChange={(e) => updateFilter("window", e.target.value)}
        >
          <option value="all">Window: All</option>
          <option value="30">&le; 30 Days</option>
          <option value="60">31–60 Days</option>
          <option value="90">61–90 Days</option>
          <option value="90plus">&gt; 90 Days</option>
        </select>

        <select
          className={`h-8 px-2.5 py-0 border rounded-lg text-[10px] font-bold uppercase tracking-wider outline-none focus:ring-1 focus:ring-primary/30 cursor-pointer transition-all hover:brightness-95 ${filters.risk !== 'all' ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted/10 border-border/50 text-muted-foreground hover:border-border/80'}`}
          value={filters.risk}
          onChange={(e) => updateFilter("risk", e.target.value)}
        >
          <option value="all">Risk: All</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select
          className={`h-8 px-2.5 py-0 border rounded-lg text-[10px] font-bold uppercase tracking-wider outline-none focus:ring-1 focus:ring-primary/30 cursor-pointer transition-all hover:brightness-95 ${filters.category !== 'all' ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted/10 border-border/50 text-muted-foreground hover:border-border/80'}`}
          value={filters.category}
          onChange={(e) => updateFilter("category", e.target.value)}
        >
          {/*
            Labelled Criticality, because that is what the field holds. The page maps
            `category: b.criticality`, and `/api/expiry/batches` returns no product
            category at all - so this offered six drug categories that were compared
            against CRITICAL/HIGH/MEDIUM/LOW and could never match one.
          */}
          <option value="all">Criticality: All</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>

        <select
          className={`h-8 px-2.5 py-0 border rounded-lg text-[10px] font-bold uppercase tracking-wider outline-none focus:ring-1 focus:ring-primary/30 cursor-pointer transition-all hover:brightness-95 ${!selectedDcId && filters.location !== 'all' ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted/10 border-border/50 text-muted-foreground hover:border-border/80'}`}
          value={displayLocation}
          onChange={(e) => updateFilter("location", e.target.value)}
        >
          {selectedDcId && selectedWarehouse ? (
            <option value={selectedWarehouse.name}>{selectedWarehouse.name}</option>
          ) : (
            <>
              <option value="all">Location: All DCs</option>
              {(warehouses ?? []).map((warehouse) => (
                <option key={warehouse.id} value={warehouse.name}>
                  {warehouse.name}
                </option>
              ))}
            </>
          )}
        </select>

        <select
          className={`h-8 px-2.5 py-0 border rounded-lg text-[10px] font-bold uppercase tracking-wider outline-none focus:ring-1 focus:ring-primary/30 cursor-pointer transition-all hover:brightness-95 ${filters.status !== 'all' ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted/10 border-border/50 text-muted-foreground hover:border-border/80'}`}
          value={filters.status}
          onChange={(e) => updateFilter("status", e.target.value)}
        >
          {/*
            The four statuses the page actually derives. These were "Overstock /
            Normal / Below Safety Stock" - none of which the page produces - and
            `filters.status` was read by nothing at all, so the control was doubly
            decorative while still highlighting itself as active.
          */}
          <option value="all">Status: All</option>
          <option value="prioritized">Prioritise</option>
          <option value="transfer">Transfer</option>
          <option value="monitor">Monitor</option>
          <option value="normal">No action</option>
        </select>
      </div>
    </div>
  );
}
