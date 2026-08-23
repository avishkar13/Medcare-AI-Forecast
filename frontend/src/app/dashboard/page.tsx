import { PageHeader } from "@/components/dashboard/page-header";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { NetworkHealth } from "@/components/dashboard/network-health";
import { PriorityActions } from "@/components/dashboard/priority-actions";
import { AIEngineStatus } from "@/components/dashboard/ai-engine-status";
import { DemandForecastChart } from "@/components/charts/demand-forecast-chart";
import { InventoryHealthChart } from "@/components/charts/inventory-health-chart";
import { ExpiryRiskPanel } from "@/components/dashboard/expiry-risk-panel";
import { InventoryDistribution } from "@/components/dashboard/inventory-distribution";
import { AIRecommendations } from "@/components/dashboard/ai-recommendations";
import { OptimizationSummary } from "@/components/dashboard/optimization-summary";
import { WhatIfSimulation } from "@/components/dashboard/what-if-simulation";
import { ExecutiveDecisionPanel } from "@/components/dashboard/executive-decision-panel";

export default function DashboardPage() {
  return (
    <div className="flex flex-col w-full max-w-7xl mx-auto">
      <PageHeader />
      
      <div className="flex flex-col gap-6">
        <KpiCards />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <PriorityActions />
          </div>
          <div className="flex flex-col gap-6 lg:col-span-1">
            <NetworkHealth />
            <AIEngineStatus />
          </div>
        </div>

        {/* Analytical Intelligence Layer */}
        <div className="grid grid-cols-1 gap-6">
          <DemandForecastChart />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <InventoryHealthChart />
          <InventoryDistribution />
        </div>

        <div className="grid grid-cols-1 gap-4">
          <ExpiryRiskPanel />
        </div>

        {/* Decision & Optimization Layer */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <AIRecommendations />
          </div>
          <div className="flex flex-col gap-6 lg:col-span-1">
            <OptimizationSummary />
            <WhatIfSimulation />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 pb-8">
          <ExecutiveDecisionPanel />
        </div>
      </div>
    </div>
  );
}
