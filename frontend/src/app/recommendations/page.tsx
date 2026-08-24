"use client";

import { useState, useMemo } from "react";
import { RecommendationsHeader } from "@/components/recommendations/recommendations-header";
import { RecommendationsKpiCards } from "@/components/recommendations/recommendations-kpi-cards";
import { RecommendationsFilters } from "@/components/recommendations/recommendations-filters";
import { RecommendationList } from "@/components/recommendations/recommendation-list";
import { RecommendationImpact } from "@/components/recommendations/recommendation-impact";
import { RecommendationIntelligenceCard } from "@/components/recommendations/recommendation-intelligence";
import { RecommendationSummary } from "@/components/recommendations/recommendation-summary";
import { RecommendationFramework } from "@/components/recommendations/recommendation-framework";
import { mockAIRecommendations, mockRecommendationImpact, mockRecommendationIntelligence } from "@/lib/mockData";
import { RecommendationItem } from "@/types/recommendation";

export default function RecommendationsPage() {
  const [items, setItems] = useState<RecommendationItem[]>(mockAIRecommendations);

  // Filter States
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("all priority");
  const [actionType, setActionType] = useState("all actions");
  const [location, setLocation] = useState("all locations");
  const [status, setStatus] = useState("Pending");
  const [sortBy, setSortBy] = useState("priority");

  const filteredItems = useMemo(() => {
    let result = items.filter(item => {
      const matchSearch = !search ||
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.sku.toLowerCase().includes(search.toLowerCase());
      const matchPriority = priority === "all priority" || item.priority === priority;
      const matchAction = actionType === "all actions" || item.actionType === actionType;
      const matchLocation = location === "all locations" || item.location === location || item.fromLocation === location;
      const matchStatus = status === "all statuses" || item.status === status;

      return matchSearch && matchPriority && matchAction && matchLocation && matchStatus;
    });

    result = result.sort((a, b) => {
      if (sortBy === "priority") {
        const priorityOrder: Record<string, number> = { "Critical": 0, "High": 1, "Medium": 2, "Low": 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      if (sortBy === "confidence") {
        return b.confidence - a.confidence;
      }
      if (sortBy === "impact") {
        return b.impactValue - a.impactValue;
      }
      if (sortBy === "newest") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return 0;
    });

    return result;
  }, [items, search, priority, actionType, location, status, sortBy]);

  const handleExecute = (id: string) => {
    setItems(current =>
      current.map(item =>
        item.id === id ? { ...item, status: "Executed" as const } : item
      )
    );
  };

  const handleDismiss = (id: string) => {
    setItems(current =>
      current.map(item =>
        item.id === id ? { ...item, status: "Dismissed" as const } : item
      )
    );
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-10 min-h-screen">
      <RecommendationsHeader />
      <RecommendationsKpiCards />

      <RecommendationsFilters
        search={search} setSearch={setSearch}
        priority={priority} setPriority={setPriority}
        actionType={actionType} setActionType={setActionType}
        location={location} setLocation={setLocation}
        status={status} setStatus={setStatus}
        sortBy={sortBy} setSortBy={setSortBy}
      />

      {/* 65% / 35% Two Column Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* Left Column - Recommendations Queue */}
        <div className="xl:col-span-8 h-[600px] xl:h-auto xl:relative">
          <div className="h-full xl:absolute xl:inset-0">
            <RecommendationList
              recommendations={filteredItems}
              onExecute={handleExecute}
              onDismiss={handleDismiss}
            />
          </div>
        </div>

        {/* Right Column - Intelligence & Impact */}
        <div className="xl:col-span-4 flex flex-col gap-6">
          <RecommendationImpact data={mockRecommendationImpact} />
          <RecommendationIntelligenceCard data={mockRecommendationIntelligence} />
          <RecommendationSummary items={items} />
        </div>

      </div>

      <RecommendationFramework />
    </div>
  );
}
