"use client";

import { Suspense, useState, useMemo } from "react";
import { useScope } from "@/hooks/use-scope";
import { RecommendationsHeader } from "@/components/recommendations/recommendations-header";
import { RecommendationsKpiCards } from "@/components/recommendations/recommendations-kpi-cards";
import { RecommendationsFilters } from "@/components/recommendations/recommendations-filters";
import { RecommendationList } from "@/components/recommendations/recommendation-list";
import { RecommendationImpact } from "@/components/recommendations/recommendation-impact";
import { RecommendationIntelligenceCard } from "@/components/recommendations/recommendation-intelligence";
import { RecommendationSummary } from "@/components/recommendations/recommendation-summary";
import { RecommendationFramework } from "@/components/recommendations/recommendation-framework";
import {
  useRecommendationAction,
  useRecommendationImpact,
  useRecommendationIntelligence,
  useRecommendations,
} from "@/hooks/use-recommendations";
import { toRecommendationItem } from "@/lib/api/recommendations";
import { RecommendationItem } from "@/types/recommendation";

const share = (
  byType: { type: string; sharePercent: number | null }[] | undefined,
  type: string,
) => byType?.find((row) => row.type === type)?.sharePercent ?? 0;

/**
 * `useScope` reads `useSearchParams`, which opts a route out of static rendering
 * unless it sits behind a Suspense boundary - the same shape `app/alerts/page.tsx` uses.
 */
export default function RecommendationsPage() {
  return (
    <Suspense
      fallback={<p className="p-6 text-sm text-muted-foreground">Loading recommendations…</p>}
    >
      <RecommendationsView />
    </Suspense>
  );
}

function RecommendationsView() {
  /**
   * Called for its effect, not its return value: `useScope` is what writes `?dc=` and
   * `?sku=` into the ui store, and this page never called it - so the store still held
   * whichever SKU the *previous* page had set, and a deep link here was ignored while
   * a stale scope was silently applied.
   */
  useScope();

  const { data, isPending, isError } = useRecommendations({ pageSize: 200 });
  const impact = useRecommendationImpact();
  const intelligence = useRecommendationIntelligence();
  const { execute, dismiss } = useRecommendationAction();

  const items: RecommendationItem[] = useMemo(
    () => (data?.data ?? []).map(toRecommendationItem),
    [data],
  );

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

  // the server owns the transition and refuses a second one, so the list is
  // refetched rather than patched locally.
  const handleExecute = (id: string) => execute.mutate(id);
  const handleDismiss = (id: string) => dismiss.mutate(id);

  if (isPending) {
    return <p className="text-sm text-muted-foreground p-6">Loading recommendations…</p>;
  }

  if (isError) {
    return <p className="text-sm text-muted-foreground p-6">Could not load recommendations.</p>;
  }

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
        <div className="xl:col-span-8 h-[600px] xl:h-[1300px]">
          <RecommendationList
            recommendations={filteredItems}
            onExecute={handleExecute}
            onDismiss={handleDismiss}
          />
        </div>

        {/* Right Column - Intelligence & Impact */}
        <div className="xl:col-span-4 flex flex-col gap-6">
          <RecommendationImpact
            data={{
              // planCost is what the run costs; attributedImpact is what the
              // recommendations are worth if acted on.
              currentSupplyChainCost: impact.data?.planCost?.total ?? 0,
              aiOptimizedCost: Math.max(
                0,
                (impact.data?.planCost?.total ?? 0) - (impact.data?.attributedImpact ?? 0),
              ),
              projectedSavings: impact.data?.attributedImpact ?? 0,
              costReductionPercentage:
                impact.data?.planCost?.total
                  ? Number(
                      (
                        (impact.data.attributedImpact / impact.data.planCost.total) *
                        100
                      ).toFixed(1),
                    )
                  : 0,
              categories: {
                stockout: share(impact.data?.byType, "STOCKOUT_RISK"),
                excessInventory: share(impact.data?.byType, "REDUCE_SUPPLY"),
                expiry: share(impact.data?.byType, "EXPIRY_RISK"),
                transfers: share(impact.data?.byType, "TRANSFER_STOCK"),
              },
            }}
          />
          <RecommendationIntelligenceCard
            data={{
              // signalsCited is empty until the executor attaches signal rows
              signals: { demandForecast: 0, inventoryPosition: 0, leadTime: 0, expiryRisk: 0 },
              modelConfidence: intelligence.data?.averageConfidence ?? 0,
              explanation: intelligence.data?.modelVersion
                ? `${intelligence.data.recommendationCount} recommendations from ${intelligence.data.modelVersion} over a ${intelligence.data.horizonDays}-day horizon.`
                : "No completed planning run yet.",
            }}
          />
          <RecommendationSummary />
        </div>

      </div>

      <RecommendationFramework />
    </div>
  );
}
