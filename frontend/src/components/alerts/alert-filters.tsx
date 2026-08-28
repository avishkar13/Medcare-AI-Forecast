"use client";

import { useWarehouses } from "@/hooks/use-masterdata";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, RotateCcw, ArrowUpDown } from "lucide-react";
import { AlertSeverity, AlertType, AlertStatus } from "@/types/alert";

export interface AlertFilterState {
  search: string;
  severity: AlertSeverity | "all";
  type: AlertType | "all";
  status: AlertStatus | "all" | "open";
  location: string;
  sortBy: "severity" | "newest" | "oldest";
}

/**
 * The landing view. Lives here rather than in the page so "is anything filtered?"
 * below and "what does Reset go back to?" cannot drift apart - they did the moment
 * the default stopped being `all` across the board.
 */
export const DEFAULT_ALERT_FILTERS: AlertFilterState = {
  search: "",
  severity: "all",
  type: "all",
  status: "open",
  location: "all",
  sortBy: "severity",
};

interface AlertFiltersProps {
  filters: AlertFilterState;
  onChange: (filters: AlertFilterState) => void;
  onReset: () => void;
}

export function AlertFilters({ filters, onChange, onReset }: AlertFiltersProps) {
  const { data: warehouses } = useWarehouses();

  const updateFilter = (key: keyof AlertFilterState, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  const hasActiveFilters = (
    Object.keys(DEFAULT_ALERT_FILTERS) as (keyof AlertFilterState)[]
  ).some((key) => key !== "sortBy" && filters[key] !== DEFAULT_ALERT_FILTERS[key]);

  return (
    <div className="bg-background border border-border/60 rounded-xl p-2.5 shadow-sm flex flex-col gap-2.5">
      <div className="flex flex-col md:flex-row gap-2">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search SKU, alert, location..."
            className="pl-9 h-8 text-[11px] font-medium bg-muted/10 border-border/50 focus-visible:ring-1 focus-visible:ring-primary/30 transition-all rounded-md"
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-8 px-2 text-[10px] font-bold text-muted-foreground hover:text-foreground" onClick={onReset}>
              <RotateCcw className="h-3 w-3 mr-1.5" />
              Reset
            </Button>
          )}
          <div className="flex items-center gap-1.5 border border-border/50 rounded-md px-2 bg-muted/5 h-8 hover:bg-muted/10 transition-colors">
            <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
            <select
              className="bg-transparent text-[10px] font-bold uppercase tracking-wider outline-none text-foreground pr-2 cursor-pointer"
              value={filters.sortBy}
              onChange={(e) => updateFilter("sortBy", e.target.value)}
            >
              <option value="severity">Sort by: Severity</option>
              <option value="newest">Sort by: Newest</option>
              <option value="oldest">Sort by: Oldest</option>
              {/*
                "Business Impact" used to be a fourth option here and the page had no
                branch for it, so choosing it silently gave you severity order.
                `businessImpact` is a sentence, not a figure - there is nothing to sort
                on - so the option is gone rather than quietly lying about the order.
              */}
            </select>
          </div>
        </div>
      </div>

      {/* Select Filters Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <select
          className={`h-7 px-2 py-0 border rounded-[4px] text-[10px] font-bold uppercase tracking-wider outline-none focus:ring-1 focus:ring-primary/30 cursor-pointer transition-colors ${filters.severity !== 'all' ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted/10 border-border/50 text-muted-foreground'}`}
          value={filters.severity}
          onChange={(e) => updateFilter("severity", e.target.value)}
        >
          <option value="all">Severity: All</option>
          <option value="critical">Critical Only</option>
          <option value="high">High Priority</option>
          <option value="medium">Medium Priority</option>
          <option value="low">Low Priority</option>
        </select>

        <select
          className={`h-7 px-2 py-0 border rounded-[4px] text-[10px] font-bold uppercase tracking-wider outline-none focus:ring-1 focus:ring-primary/30 cursor-pointer transition-colors ${filters.type !== 'all' ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted/10 border-border/50 text-muted-foreground'}`}
          value={filters.type}
          onChange={(e) => updateFilter("type", e.target.value)}
        >
          <option value="all">Type: All Alerts</option>
          <option value="stockout_risk">Stockout Risk</option>
          <option value="demand_spike">Demand Spike</option>
          <option value="expiry_risk">Expiry Risk</option>
          <option value="overstock">Overstock</option>
          <option value="supplier_delay">Supplier Delay</option>
          <option value="capacity_breach">Capacity Breach</option>
          <option value="forecast_anomaly">Forecast Anomaly</option>
        </select>

        <select
          className={`h-7 px-2 py-0 border rounded-[4px] text-[10px] font-bold uppercase tracking-wider outline-none focus:ring-1 focus:ring-primary/30 cursor-pointer transition-colors ${filters.status !== 'all' ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted/10 border-border/50 text-muted-foreground'}`}
          value={filters.status}
          onChange={(e) => updateFilter("status", e.target.value)}
        >
          <option value="all">Status: All</option>
          {/* The backend's own alias for "not resolved". This is the landing view, so
              "All" is free to mean all - resolved included - rather than both. */}
          <option value="open">Open</option>
          <option value="new">New</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
        </select>

        <select
          className={`h-7 px-2 py-0 border rounded-[4px] text-[10px] font-bold uppercase tracking-wider outline-none focus:ring-1 focus:ring-primary/30 cursor-pointer transition-colors ${filters.location !== 'all' ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted/10 border-border/50 text-muted-foreground'}`}
          value={filters.location}
          onChange={(e) => updateFilter("location", e.target.value)}
        >
          {/*
            Built from the warehouse list, not hardcoded. The four names here were
            "Northeast DC / South DC / West Coast DC / Midwest DC" - none of which
            exist in this database - so every option returned zero rows. `location`
            matches on the display name, which is what the backend filters on.
          */}
          <option value="all">Location: All DCs</option>
          {(warehouses ?? []).map((warehouse) => (
            <option key={warehouse.id} value={warehouse.name}>
              {warehouse.name}
            </option>
          ))}
        </select>

        {/*
          The Time filter used to live here. `filters.time` was written by it and read
          by nothing - not the query, not the client-side narrowing - so all four
          options were decorative, and the control even highlighted itself as active.
          Removed rather than wired: `/api/alerts` has no date-range parameter, so
          honouring it would mean narrowing one page of results and calling it a filter.
        */}
      </div>
    </div>
  );
}
