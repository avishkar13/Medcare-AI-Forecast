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
import { PlanVsActual } from "@/components/dashboard/plan-vs-actual";
import { WhatIfSimulation } from "@/components/dashboard/what-if-simulation";
import { ExecutiveDecisionPanel } from "@/components/dashboard/executive-decision-panel";
import { LiveActivity } from "@/components/dashboard/live-activity";
import { PositionProjection } from "@/components/dashboard/position-projection";

export default function DashboardPage() {
  return (
    <div className="flex flex-col w-full max-w-7xl mx-auto relative min-h-screen">
      {/* Decorative background glows */}
      <div className="absolute top-[-100px] left-1/4 w-[600px] h-[400px] bg-primary/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
      <div className="absolute top-[600px] right-0 w-[500px] h-[500px] bg-ai/5 rounded-full blur-[120px] -z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[800px] h-[600px] bg-warning/5 rounded-full blur-[150px] -z-10 pointer-events-none" />

      <PageHeader />
      
      <div className="flex flex-col gap-6">
        <KpiCards />
        
        <div className="grid [&>*]:min-w-0 grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <PriorityActions />
          </div>
          <div className="flex flex-col gap-6 lg:col-span-1">
            <NetworkHealth />
            <AIEngineStatus />
          </div>
        </div>

        {/* The execution loop - what just moved, and what the plan says happens next. */}
        <div className="grid [&>*]:min-w-0 grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <PositionProjection />
          </div>
          <div className="lg:col-span-1">
            <LiveActivity />
          </div>
        </div>

        {/* Analytical Intelligence Layer */}
        <div className="grid grid-cols-1 gap-6">
          <DemandForecastChart />
        </div>

        <div className="grid [&>*]:min-w-0 grid-cols-1 lg:grid-cols-2 gap-6">
          <InventoryHealthChart />
          <InventoryDistribution />
        </div>

        <div className="grid grid-cols-1 gap-4">
          <ExpiryRiskPanel />
        </div>

        {/* Decision & Optimization Layer */}
        <div className="grid [&>*]:min-w-0 grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-[600px] lg:h-[1500px]">
            <AIRecommendations />
          </div>
          <div className="flex flex-col gap-6 lg:col-span-1">
            <OptimizationSummary />
            <PlanVsActual />
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
