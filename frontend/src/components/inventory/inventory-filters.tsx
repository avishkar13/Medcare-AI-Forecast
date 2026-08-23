"use client";

import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface InventoryFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  location: string;
  onLocationChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  risk: string;
  onRiskChange: (value: string) => void;
  categories: string[];
  locations: string[];
  onReset: () => void;
}

const statusOptions = [
  { value: "all", label: "All Status" },
  { value: "healthy", label: "Healthy" },
  { value: "reorder_required", label: "Reorder Required" },
  { value: "overstocked", label: "Overstocked" },
  { value: "at_risk", label: "At Risk" },
  { value: "expiring", label: "Expiring" },
];

const riskOptions = [
  { value: "all", label: "All Risk" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const selectClass =
  "h-8 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer";

export function InventoryFilters({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  location,
  onLocationChange,
  status,
  onStatusChange,
  risk,
  onRiskChange,
  categories,
  locations,
  onReset,
}: InventoryFiltersProps) {
  const hasActiveFilters = search || category !== "all" || location !== "all" || status !== "all" || risk !== "all";

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search SKU or product..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full h-8 rounded-md border border-input bg-background pl-9 pr-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground"
            />
          </div>

          {/* Category */}
          <select className={selectClass} value={category} onChange={(e) => onCategoryChange(e.target.value)}>
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Location */}
          <select className={selectClass} value={location} onChange={(e) => onLocationChange(e.target.value)}>
            <option value="all">All Locations</option>
            {locations.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>

          {/* Status */}
          <select className={selectClass} value={status} onChange={(e) => onStatusChange(e.target.value)}>
            {statusOptions.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          {/* Risk */}
          <select className={selectClass} value={risk} onChange={(e) => onRiskChange(e.target.value)}>
            {riskOptions.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>

          {/* Reset */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={onReset} className="h-8 gap-1.5 text-muted-foreground cursor-pointer">
              <X className="h-3.5 w-3.5" />
              Reset
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
