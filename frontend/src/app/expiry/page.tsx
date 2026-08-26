"use client";

import { useState, useMemo } from "react";
import { useDcExposure, useExpiryBatches, useWastePrevention } from "@/hooks/use-expiry";
import { ExpiryBatch } from "@/types/expiry";

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

export default function ExpiryRiskPage() {
  const batchQuery = useExpiryBatches();
  const exposure = useDcExposure();
  const waste = useWastePrevention();

  // the api reports risk and value; forecastDemand and wasteProbability have no
  // source on a batch, so they stay at zero rather than being invented.
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
    forecastDemand: 0,
    demandCoverage: 0,
    inventoryValue: b.inventoryValue,
    riskLevel: b.riskLevel,
    wasteProbability: 0,
    wasteValue: 0,
        status: "at-risk" as ExpiryBatch["status"],
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

  const handleActionClick = (batch: ExpiryBatch, action: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent opening sheet
    // In a real app, dispatch an action here
    // alert(`Action: ${action} on batch ${batch.batchNumber}`);
  };

  const handlePrioritize = () => {
    // Mock action
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
          <FEFOPriorityQueue batches={batches} />
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
          <PreventedWaste records={waste.data?.items ?? []} />
        </div>
      </div>

      <BatchDetailsSheet 
        batch={selectedBatch} 
        isOpen={isSheetOpen} 
        onClose={() => setIsSheetOpen(false)} 
        onPrioritize={handlePrioritize}
      />
    </div>
  );
}
