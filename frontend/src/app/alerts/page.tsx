"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertsHeader } from "@/components/alerts/alerts-header";
import { AlertOverview } from "@/components/alerts/alert-overview";
import { AlertFilters, AlertFilterState } from "@/components/alerts/alert-filters";
import { ActiveAlertList } from "@/components/alerts/active-alert-list";
import { AlertDetailsSheet } from "@/components/alerts/alert-details-sheet";
import { AlertTrends } from "@/components/alerts/alert-trends";
import { MonitoringHealth } from "@/components/alerts/monitoring-health";
import { AlertDistribution } from "@/components/alerts/alert-distribution";

import { useAlertActions, useAlertOverview, useAlerts } from "@/hooks/use-alerts";
import { SystemAlert } from "@/types/alert";

const defaultFilters: AlertFilterState = {
  search: "",
  severity: "all",
  type: "all",
  status: "all",
  location: "all",
  time: "all",
  sortBy: "severity",
};

const SEVERITY_WEIGHT: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

/**
 * `useSearchParams` opts a route out of static rendering unless it sits behind a
 * Suspense boundary. Kept in a child so the shell still prerenders and only the part
 * that depends on the query string waits.
 */
export default function AlertsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading alerts…</p>}>
      <AlertsView />
    </Suspense>
  );
}

function AlertsView() {
  const params = useSearchParams();
  // A link from the bell, a toast or an alert detail arrives already scoped.
  const dc = params.get("dc") ?? undefined;
  const sku = params.get("sku") ?? undefined;

  const [filters, setFilters] = useState<AlertFilterState>(defaultFilters);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);

  /**
   * Narrowing happens on the server.
   *
   * This page used to ask for `pageSize: 200` and filter the result in the browser,
   * which made paging decorative and meant every filter only ever narrowed whichever
   * 200 rows came back first. `status: "open"` is the default view because a resolved
   * alert is history, not something to act on.
   */
  const { data, isPending, isError, isFetching } = useAlerts({
    ...(filters.severity === "all" ? {} : { severity: filters.severity }),
    ...(filters.type === "all" ? {} : { type: filters.type }),
    ...(filters.location === "all" ? {} : { location: filters.location }),
    status: filters.status === "all" ? "open" : filters.status,
    ...(dc ? { warehouseId: dc } : {}),
    pageSize: 100,
  });

  const overviewQuery = useAlertOverview();
  const actions = useAlertActions();

  const alerts: SystemAlert[] = useMemo(() => data?.data ?? [], [data]);

  const overviewStats = useMemo(() => {
    const live = overviewQuery.data;
    if (live) return { ...live, resolvedPercentage: live.resolvedPercentage ?? 0 };

    // Until the overview lands, count what is on screen rather than showing zeros.
    return {
      totalCount: alerts.length,
      criticalCount: alerts.filter((alert) => alert.severity === "critical").length,
      highCount: alerts.filter((alert) => alert.severity === "high").length,
      unresolvedCount: alerts.filter((alert) => alert.status !== "resolved").length,
      todayCount: 0,
      todayDelta: 0,
      resolvedCount: 0,
      resolvedPercentage: 0,
    };
  }, [alerts, overviewQuery.data]);

  /**
   * Search, the SKU deep link and sort order stay client-side.
   *
   * The list route has no free-text search and no sort parameter; adding both is
   * Phase 2 work. Over one page of results this is honest rather than misleading,
   * which the 200-row version was not.
   */
  const visibleAlerts = useMemo(() => {
    let result = [...alerts];

    if (sku) result = result.filter((alert) => alert.sku === sku);

    if (filters.search) {
      const needle = filters.search.toLowerCase();
      result = result.filter(
        (alert) =>
          alert.title.toLowerCase().includes(needle) ||
          alert.sku?.toLowerCase().includes(needle) ||
          alert.location.toLowerCase().includes(needle),
      );
    }

    return result.sort((left, right) => {
      if (filters.sortBy === "newest") {
        return new Date(right.detectedAt).getTime() - new Date(left.detectedAt).getTime();
      }
      if (filters.sortBy === "oldest") {
        return new Date(left.detectedAt).getTime() - new Date(right.detectedAt).getTime();
      }
      return (SEVERITY_WEIGHT[right.severity] ?? 0) - (SEVERITY_WEIGHT[left.severity] ?? 0);
    });
  }, [alerts, filters.search, filters.sortBy, sku]);

  const selectedAlert = useMemo(
    () => alerts.find((alert) => alert.id === selectedAlertId) ?? null,
    [alerts, selectedAlertId],
  );

  if (isPending) {
    return <p className="p-6 text-sm text-muted-foreground">Loading alerts…</p>;
  }

  if (isError) {
    return (
      <div className="p-6">
        <p className="text-sm font-medium text-foreground">Could not load alerts.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The alerts service did not answer. Detection may still be running — try again in a moment.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full max-w-7xl mx-auto flex-col gap-5 pb-10">
      <AlertsHeader onMarkAllRead={() => actions.markAllRead.mutate()} isFetching={isFetching} />

      <AlertOverview data={overviewStats} />

      <AlertFilters
        filters={filters}
        onChange={setFilters}
        onReset={() => setFilters(defaultFilters)}
      />

      <ActiveAlertList
        alerts={visibleAlerts}
        unresolvedCount={overviewStats.unresolvedCount}
        onReview={(alert) => setSelectedAlertId(alert.id)}
      />

      <div className="mt-2 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <AlertTrends />
        <MonitoringHealth />
      </div>

      <AlertDistribution />

      <AlertDetailsSheet
        alert={selectedAlert}
        isOpen={!!selectedAlertId}
        onClose={() => setSelectedAlertId(null)}
        onAcknowledge={(id) => actions.acknowledge.mutate(id)}
        onResolve={(id) => actions.resolve.mutate(id)}
      />
    </div>
  );
}
