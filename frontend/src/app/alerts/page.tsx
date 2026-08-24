"use client";

import { useState, useMemo } from "react";
import { AlertsHeader } from "@/components/alerts/alerts-header";
import { AlertOverview } from "@/components/alerts/alert-overview";
import { AlertFilters, AlertFilterState } from "@/components/alerts/alert-filters";
import { ActiveAlertList } from "@/components/alerts/active-alert-list";
import { AlertDetailsSheet } from "@/components/alerts/alert-details-sheet";
import { AlertTrends } from "@/components/alerts/alert-trends";
import { MonitoringHealth } from "@/components/alerts/monitoring-health";
import { AlertDistribution } from "@/components/alerts/alert-distribution";

import { mockSystemAlerts, mockAlertOverview } from "@/lib/mockData";
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

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<SystemAlert[]>(mockSystemAlerts);
  const [filters, setFilters] = useState<AlertFilterState>(defaultFilters);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  
  // Overview derived state
  const overviewStats = useMemo(() => {
    // In a real app, we might recalculate this based on resolved alerts,
    // but for now we'll start with mock overview and just adjust unresolved/resolved slightly if we want.
    // To keep it simple and match requirements, we'll return the mock data directly, 
    // but we can adjust it if alerts are resolved locally.
    
    let unresolvedCount = 0;
    let criticalCount = 0;
    let highCount = 0;

    alerts.forEach(a => {
      if (a.status !== "resolved") {
        unresolvedCount++;
        if (a.severity === "critical") criticalCount++;
        if (a.severity === "high") highCount++;
      }
    });

    return {
      ...mockAlertOverview,
      unresolvedCount,
      criticalCount,
      highCount,
    };
  }, [alerts]);

  // Filter & Sort Logic
  const filteredAlerts = useMemo(() => {
    let result = [...alerts];

    // Status filter (Active by default vs Resolved)
    // Actually the requirement says Status: All, New, Acknowledged, In Progress, Resolved.
    if (filters.status !== "all") {
      result = result.filter(a => a.status === filters.status);
    } else {
      // If "all" is selected, we might still want to see resolved? 
      // The prompt says "Removes it from Active Alerts" when resolved. 
      // Let's hide resolved unless explicitly searching for them or "all" is selected.
      // We will leave them in if "all" is selected, but maybe default to active?
      // The user requested: "Removes it from Active Alerts" upon resolving.
      // So if status is 'all', let's actually just show non-resolved by default to act as an "Active Alerts" list,
      // but to be perfectly aligned with standard filtering, "all" means all.
      // I'll show all. The resolved ones will just look resolved.
      // Wait, "Removes it from Active Alerts" implies the list is Active Alerts.
      // Let's filter out resolved unless status === 'resolved'
      result = result.filter(a => a.status !== "resolved"); 
    }

    // Search filter
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(a => 
        a.title.toLowerCase().includes(q) || 
        (a.sku && a.sku.toLowerCase().includes(q)) || 
        a.location.toLowerCase().includes(q)
      );
    }

    // Severity filter
    if (filters.severity !== "all") {
      result = result.filter(a => a.severity === filters.severity);
    }

    // Type filter
    if (filters.type !== "all") {
      result = result.filter(a => a.type === filters.type);
    }

    // Location filter
    if (filters.location !== "all") {
      result = result.filter(a => a.location === filters.location);
    }

    // Time filter (Mocked logic, just returning all for simplicity in mock)
    // In a real app we'd parse detectedAt.

    // Sorting
    result.sort((a, b) => {
      if (filters.sortBy === "severity") {
        const severityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
        return severityWeight[b.severity] - severityWeight[a.severity];
      }
      if (filters.sortBy === "newest") {
        return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
      }
      if (filters.sortBy === "oldest") {
        return new Date(a.detectedAt).getTime() - new Date(b.detectedAt).getTime();
      }
      return 0; // impact fallback to order
    });

    return result;
  }, [alerts, filters]);

  // Actions
  const handleAcknowledge = (id: string) => {
    setAlerts(alerts.map(a => a.id === id ? { ...a, status: "acknowledged" } : a));
  };

  const handleResolve = (id: string) => {
    setAlerts(alerts.map(a => a.id === id ? { ...a, status: "resolved" } : a));
  };

  const handleMarkAllRead = () => {
    setAlerts(alerts.map(a => a.status === "new" ? { ...a, status: "acknowledged" } : a));
  };

  const selectedAlert = useMemo(() => alerts.find(a => a.id === selectedAlertId) || null, [alerts, selectedAlertId]);

  return (
    <div className="flex flex-col gap-5 w-full max-w-7xl mx-auto pb-10 min-h-screen">
      
      <AlertsHeader onMarkAllRead={handleMarkAllRead} />
      
      <AlertOverview data={overviewStats} />
      
      <AlertFilters 
        filters={filters} 
        onChange={setFilters} 
        onReset={() => setFilters(defaultFilters)} 
      />
      
      <ActiveAlertList 
        alerts={filteredAlerts} 
        unresolvedCount={overviewStats.unresolvedCount}
        onReview={(alert) => setSelectedAlertId(alert.id)}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-2">
        <AlertTrends />
        <MonitoringHealth />
      </div>

      <AlertDistribution />

      <AlertDetailsSheet 
        alert={selectedAlert} 
        isOpen={!!selectedAlertId} 
        onClose={() => setSelectedAlertId(null)}
        onAcknowledge={handleAcknowledge}
        onResolve={handleResolve}
      />
    </div>
  );
}
