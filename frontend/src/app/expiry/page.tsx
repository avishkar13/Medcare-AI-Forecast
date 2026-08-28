"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useScopedHref } from "@/hooks/use-scope";
import { useDcExposure, useExpiryBatches, useWastePrevention } from "@/hooks/use-expiry";
import { ExpiryBatch, ExpiryStatus } from "@/types/expiry";

import { ExpiryHeader } from "@/components/expiry/expiry-header";
import { ExpiryOverview } from "@/components/expiry/expiry-overview";
import { ExpiryFilters } from "@/components/expiry/expiry-filters";
import { ExpiryExposure } from "@/components/expiry/expiry-exposure";
import { ExpiryTimeline } from "@/components/expiry/expiry-timeline";
import { AtRiskBatchTable } from "@/components/expiry/at-risk-batch-table";
import { FEFOPriorityQueue } from "@/components/expiry/fefo-priority-queue";
import { DemandExpiryAnalysis } from "@/components/expiry/demand-expiry-analysis";
import { AIExpiryAssessment } from "@/components/expiry/ai-expiry-assessment";
import { WastePreventionImpact } from "@/components/expiry/waste-prevention-impact";
import { DCExpiryExposure } from "@/components/expiry/dc-expiry-exposure";
import { PreventedWaste } from "@/components/expiry/prevented-waste";
import { BatchDetailsSheet } from "@/components/expiry/batch-details-sheet";

/** Inside this window a consumable batch has to be pushed out first, not merely watched. */
const FEFO_URGENT_DAYS = 30;

/**
 * What to do with a batch, derived from whether local demand can consume it in time.
 *
 * Every batch used to be stamped `"at-risk"` - a value not even in `ExpiryStatus` - so the
 * action column fell to its default for all of them and said nothing useful. These four
 * outcomes are the ones the FEFO queue already knows how to label.
 */
const statusOf = (demandCoveragePercent: number, daysRemaining: number): ExpiryStatus => {
  // Demand will absorb the whole batch before it expires; nothing to intervene in.
  if (demandCoveragePercent >= 100) return "normal";

  // Local demand cannot consume most of it, so the units have to go where demand is.
  if (demandCoveragePercent < 60) return "transfer";

  // Consumable in principle, but only if it moves first - which is what FEFO is for.
  if (daysRemaining <= FEFO_URGENT_DAYS) return "prioritized";

  return "monitor";
};

export default function ExpiryRiskPage() {
  const router = useRouter();
  const scopedHref = useScopedHref();
  const batchQuery = useExpiryBatches();
  const exposure = useDcExposure();
  const waste = useWastePrevention();

  const batches: ExpiryBatch[] = useMemo(
    () =>
      (batchQuery.data?.data ?? []).map((b) => ({
    id: b.id,
    sku: b.sku,
    productName: b.productName,
    category: b.criticality,
    batchNumber: b.batchNumber,
    location: b.warehouseName,
    quantity: b.quantity,
    unitCost: b.unitCost,
    expiryDate: b.expiryDate,
    daysRemaining: b.daysRemaining,
    forecastDemand: b.forecastDemand,
    demandCoverage: b.demandCoveragePercent,
    inventoryValue: b.inventoryValue,
    riskLevel: b.riskLevel,
    wasteSharePercent: b.projectedWasteSharePercent,
    projectedWasteUnits: b.projectedWasteUnits,
    wasteValue: b.projectedWasteValue,
        status: statusOf(b.demandCoveragePercent, b.daysRemaining),
      })),
    [batchQuery.data],
  );

  const [fefoActive, setFefoActive] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<ExpiryBatch | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  
  const [filters, setFilters] = useState({
    search: "",
    window: "all",
    risk: "all",
    category: "all",
    location: "all",
    status: "all",
    sortBy: "earliest_expiry"
  });

  const updateFilter = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      search: "",
      window: "all",
      risk: "all",
      category: "all",
      location: "all",
      status: "all",
      sortBy: "earliest_expiry"
    });
  };

  const filteredAndSortedBatches = useMemo(() => {
    let result = [...batches];

    // Search
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(b => 
        b.productName.toLowerCase().includes(q) || 
        b.sku.toLowerCase().includes(q) || 
        b.batchNumber.toLowerCase().includes(q) ||
        b.location.toLowerCase().includes(q)
      );
    }

    // Expiry Window
    if (filters.window !== "all") {
      const days = parseInt(filters.window);
      if (days === 30) result = result.filter(b => b.daysRemaining <= 30);
      else if (days === 60) result = result.filter(b => b.daysRemaining > 30 && b.daysRemaining <= 60);
      else if (days === 90) result = result.filter(b => b.daysRemaining > 60 && b.daysRemaining <= 90);
      else if (filters.window === "90plus") result = result.filter(b => b.daysRemaining > 90);
    }

    // Risk
    if (filters.risk !== "all") {
      result = result.filter(b => b.riskLevel === filters.risk);
    }

    // Category
    if (filters.category !== "all") {
      result = result.filter(b => b.category === filters.category);
    }

    // Location
    // Was collected by the filter bar and read by nothing, so all four options did
    // nothing while the control highlighted itself as active.
    if (filters.status !== "all") {
      result = result.filter(b => b.status === filters.status);
    }

    if (filters.location !== "all") {
      result = result.filter(b => b.location === filters.location);
    }

    // FEFO Override
    if (fefoActive) {
      // Prioritize earliest expiry & highest waste risk
      result.sort((a, b) => {
        if (a.daysRemaining !== b.daysRemaining) return a.daysRemaining - b.daysRemaining;
        return b.wasteValue - a.wasteValue;
      });
    } else {
      // Normal Sort
      switch (filters.sortBy) {
        case "earliest_expiry":
          result.sort((a, b) => a.daysRemaining - b.daysRemaining);
          break;
        case "highest_value":
          result.sort((a, b) => b.inventoryValue - a.inventoryValue);
          break;
        case "highest_quantity":
          result.sort((a, b) => b.quantity - a.quantity);
          break;
        case "highest_waste":
          result.sort((a, b) => b.wasteValue - a.wasteValue);
          break;
        case "demand_coverage":
          result.sort((a, b) => a.demandCoverage - b.demandCoverage);
          break;
      }
    }

    return result;
  }, [batches, filters, fefoActive]);

  const handleBatchClick = (batch: ExpiryBatch) => {
    setSelectedBatch(batch);
    setIsSheetOpen(true);
  };

  /**
   * Where each batch action actually happens.
   *
   * These two handlers were empty - `// In a real app, dispatch an action here` - so
   * every action button on this page did nothing, and the sheet's closed itself
   * afterwards so it looked like it had worked.
   *
   * There is no backend to call: every route on `/api/expiry` is a GET, and the batch
   * `status` these buttons branch on is derived in this file rather than stored. So
   * each action navigates to the surface where it can genuinely be carried out, which
   * is the honest reading of "prioritise this batch".
   */
  const destinationFor = (batch: ExpiryBatch) => {
    if (batch.status === "transfer") {
      // An inter-DC move is a DRP lane, and that is what the Transfers tab shows.
      return scopedHref("/plans", { sku: batch.sku });
    }
    if (batch.status === "prioritized") {
      // FEFO priority is expressed as a recommendation against the SKU.
      return scopedHref("/recommendations", { sku: batch.sku });
    }
    // Nothing to do but watch it: its stock position is where that is done.
    return scopedHref("/inventory", { sku: batch.sku });
  };

  const handleActionClick = (batch: ExpiryBatch, _action: string, e: React.MouseEvent) => {
    // The row opens the sheet; the button is a different destination, so it must not
    // also trigger the row.
    e.stopPropagation();
    router.push(destinationFor(batch));
  };

  return (
    <div className="flex-1 w-full p-4 md:p-8 max-w-[1600px] mx-auto overflow-y-auto no-scrollbar">
      <ExpiryHeader fefoActive={fefoActive} onFefoToggle={setFefoActive} />
      
      <ExpiryOverview />

      <ExpiryFilters filters={filters} updateFilter={updateFilter} onReset={resetFilters} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 flex flex-col">
          <ExpiryExposure />
          <ExpiryTimeline />
          <AtRiskBatchTable 
            batches={filteredAndSortedBatches} 
            onBatchClick={handleBatchClick} 
            onActionClick={handleActionClick} 
          />
        </div>
        
        <div className="flex flex-col gap-6">
          <FEFOPriorityQueue batches={filteredAndSortedBatches} />
          <AIExpiryAssessment />
        </div>
      </div>

      <div className="mb-6">
        <DemandExpiryAnalysis />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 h-[400px]">
          <WastePreventionImpact />
        </div>
        <div className="lg:col-span-1 h-[400px]">
          <DCExpiryExposure
            data={(exposure.data ?? []).map((dc) => ({
              location: dc.name,
              atRiskValue: dc.totalExposureValue,
              criticalBatches: dc.batchCount,
            }))}
          />
        </div>
        <div className="lg:col-span-1 h-[400px]">
          <PreventedWaste
            records={waste.data?.items ?? []}
            totalValueSaved={waste.data?.totalValueSaved ?? 0}
          />
        </div>
      </div>

      <BatchDetailsSheet 
        batch={selectedBatch} 
        isOpen={isSheetOpen} 
        onClose={() => setIsSheetOpen(false)} 
        destinationFor={destinationFor}
      />
    </div>
  );
}
