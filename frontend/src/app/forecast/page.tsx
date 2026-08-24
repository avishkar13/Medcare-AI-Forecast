"use client";

import { ForecastHeader } from "@/components/forecast/forecast-header";
import { ForecastControlBar } from "@/components/forecast/forecast-control-bar";
import { ForecastKpiCards } from "@/components/forecast/forecast-kpi-cards";
import { ForecastMainChart } from "@/components/forecast/forecast-main-chart";
import { ForecastSummaryPanel } from "@/components/forecast/forecast-summary-panel";
import { ForecastTrend } from "@/components/forecast/forecast-trend";
import { ForecastInsight } from "@/components/forecast/forecast-insight";
import { ForecastNetwork } from "@/components/forecast/forecast-network";
import { ForecastSeasonality } from "@/components/forecast/forecast-seasonality";
import { ForecastPerformance } from "@/components/forecast/forecast-performance";
import { ForecastImpact } from "@/components/forecast/forecast-impact";
import { ForecastSkuTable } from "@/components/forecast/forecast-sku-table";

export default function ForecastPage() {
  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-10">
      <ForecastHeader />
      <ForecastControlBar />
      <ForecastKpiCards />
      
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3 flex flex-col gap-6">
          <ForecastMainChart />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ForecastTrend />
            <ForecastInsight />
          </div>
        </div>
        <div className="xl:col-span-1">
          <ForecastSummaryPanel />
        </div>
      </div>

      <ForecastNetwork />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <ForecastSeasonality />
        </div>
        <div className="lg:col-span-1">
          <ForecastPerformance />
        </div>
        <div className="lg:col-span-1">
          <ForecastImpact />
        </div>
      </div>

      <ForecastSkuTable />
    </div>
  );
}
