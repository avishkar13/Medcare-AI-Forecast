"use client";

import { useState, useCallback } from "react";
import { ScenarioPreset, SimulationParams, SimulationOutput, SavedScenario, SimulationHistoryItem } from "@/types/simulation";
import { SCENARIO_PRESETS, runSimulation, generateScenarioSummary } from "@/lib/simulationEngine";
import { mockSimulationHistory } from "@/lib/mockData";

import { SimulationHeader } from "@/components/simulation/simulation-header";
import { ScenarioSelector } from "@/components/simulation/scenario-selector";
import { SimulationParameters } from "@/components/simulation/simulation-parameters";
import { ScenarioSummary } from "@/components/simulation/scenario-summary";
import { SimulationResults } from "@/components/simulation/simulation-results";
import { InventoryImpact } from "@/components/simulation/inventory-impact";
import { DistributionImpact } from "@/components/simulation/distribution-impact";
import { RiskAnalysis } from "@/components/simulation/risk-analysis";
import { FinancialImpactComponent } from "@/components/simulation/financial-impact";
import { AIScenarioAssessment } from "@/components/simulation/ai-scenario-assessment";
import { ScenarioComparison } from "@/components/simulation/scenario-comparison";
import { SimulationHistory } from "@/components/simulation/simulation-history";

const DEFAULT_PRESET: ScenarioPreset = "demand-surge";

export default function SimulationPage() {
  // ─── State ─────────────────────────────────────────────────────
  const [preset, setPreset] = useState<ScenarioPreset>(DEFAULT_PRESET);
  const [params, setParams] = useState<SimulationParams>(SCENARIO_PRESETS[DEFAULT_PRESET].params);
  const [isSimulating, setIsSimulating] = useState(false);
  const [hasResults, setHasResults] = useState(true);
  const [results, setResults] = useState<SimulationOutput>(() => runSimulation(DEFAULT_PRESET, SCENARIO_PRESETS[DEFAULT_PRESET].params));
  const [lastSimulation, setLastSimulation] = useState<string | null>("02:05 AM");
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);
  const [history, setHistory] = useState<SimulationHistoryItem[]>(mockSimulationHistory);
  const [summary, setSummary] = useState(() => generateScenarioSummary(DEFAULT_PRESET, SCENARIO_PRESETS[DEFAULT_PRESET].params));

  // ─── Handlers ──────────────────────────────────────────────────
  const handlePresetSelect = useCallback((newPreset: ScenarioPreset) => {
    setPreset(newPreset);
    const newParams = SCENARIO_PRESETS[newPreset].params;
    setParams(newParams);
    setSummary(generateScenarioSummary(newPreset, newParams));
  }, []);

  const handleParamChange = useCallback((key: keyof SimulationParams, value: number) => {
    setParams((prev) => {
      const updated = { ...prev, [key]: value };
      setSummary(generateScenarioSummary(preset, updated));
      return updated;
    });
  }, [preset]);

  const handleRun = useCallback(() => {
    setIsSimulating(true);
    setTimeout(() => {
      const output = runSimulation(preset, params);
      setResults(output);
      setHasResults(true);
      setIsSimulating(false);

      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
      setLastSimulation(timeStr);

      // Add to history
      const historyItem: SimulationHistoryItem = {
        id: `sim-${Date.now()}`,
        scenario: SCENARIO_PRESETS[preset].label,
        preset,
        date: now.toISOString(),
        keyChange: getKeyChange(params),
        riskLevel: output.aiInsight.overallRisk,
        resultSummary: getResultSummary(output),
        params,
      };
      setHistory((prev) => [historyItem, ...prev]);
    }, 1200);
  }, [preset, params]);

  const handleReset = useCallback(() => {
    const baselineParams = SCENARIO_PRESETS.baseline.params;
    setPreset("baseline");
    setParams(baselineParams);
    setSummary(generateScenarioSummary("baseline", baselineParams));
    const output = runSimulation("baseline", baselineParams);
    setResults(output);
    setHasResults(true);
  }, []);

  const handleResetParams = useCallback(() => {
    const presetParams = SCENARIO_PRESETS[preset].params;
    setParams(presetParams);
    setSummary(generateScenarioSummary(preset, presetParams));
  }, [preset]);

  const handleSaveCurrent = useCallback(() => {
    if (!hasResults) return;
    const saved: SavedScenario = {
      id: `saved-${Date.now()}`,
      name: SCENARIO_PRESETS[preset].label,
      preset,
      params,
      metrics: results.metrics,
      riskLevel: results.aiInsight.overallRisk,
      date: new Date().toISOString(),
    };
    setSavedScenarios((prev) => [saved, ...prev].slice(0, 3));
  }, [hasResults, preset, params, results]);

  const handleApplyScenario = useCallback((scenario: SavedScenario) => {
    setPreset(scenario.preset);
    setParams(scenario.params);
    setSummary(generateScenarioSummary(scenario.preset, scenario.params));
    const output = runSimulation(scenario.preset, scenario.params);
    setResults(output);
    setHasResults(true);
  }, []);

  const handleViewHistory = useCallback((item: SimulationHistoryItem) => {
    setPreset(item.preset);
    setParams(item.params);
    setSummary(generateScenarioSummary(item.preset, item.params));
    const output = runSimulation(item.preset, item.params);
    setResults(output);
    setHasResults(true);
  }, []);

  // AI interpretation for risk section
  const riskInterpretation = results.aiInsight.overallRisk === "critical"
    ? "Under this scenario, stockout risk becomes the dominant operational risk. Distribution centers may exceed capacity and additional replenishment should be considered."
    : results.aiInsight.overallRisk === "high"
    ? "The simulated scenario creates elevated risk across multiple dimensions. Proactive inventory repositioning is recommended."
    : results.aiInsight.overallRisk === "moderate"
    ? "Moderate risk increase detected. Monitor closely and prepare contingency measures."
    : "The network remains stable under current scenario conditions. No immediate intervention required.";

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5 w-full max-w-7xl mx-auto pb-10 min-h-screen">
      <SimulationHeader
        lastSimulation={lastSimulation}
        isSimulating={isSimulating}
        onRun={handleRun}
        onReset={handleReset}
      />

      <ScenarioSelector selected={preset} onSelect={handlePresetSelect} />

      <SimulationParameters params={params} onChange={handleParamChange} onReset={handleResetParams} />

      <ScenarioSummary preset={preset} params={params} summary={summary} />

      {hasResults && (
        <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <SimulationResults metrics={results.metrics} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <InventoryImpact skus={results.skuImpacts} />
            <DistributionImpact dcs={results.dcImpacts} />
          </div>

          <RiskAnalysis risks={results.risks} aiInterpretation={riskInterpretation} />

          <FinancialImpactComponent data={results.financial} />

          <AIScenarioAssessment insight={results.aiInsight} />
        </div>
      )}

      <ScenarioComparison
        scenarios={savedScenarios}
        onApply={handleApplyScenario}
        onSaveCurrent={handleSaveCurrent}
      />

      <SimulationHistory history={history} onView={handleViewHistory} />
    </div>
  );
}

// ─── Utility functions ───────────────────────────────────────────
function getKeyChange(params: SimulationParams): string {
  if (params.demandShock !== 0) return `${params.demandShock > 0 ? "+" : ""}${params.demandShock}% demand`;
  if (params.supplierLeadTime !== 0) return `${params.supplierLeadTime > 0 ? "+" : ""}${params.supplierLeadTime} days lead time`;
  if (params.inventoryAvailability !== 100) return `${params.inventoryAvailability}% inventory`;
  if (params.distributionCapacity !== 100) return `${params.distributionCapacity}% capacity`;
  return "Baseline";
}

function getResultSummary(output: SimulationOutput): string {
  const stockout = output.metrics[0];
  const cost = output.metrics[2];
  if (Math.abs(stockout.delta) > Math.abs(cost.delta / 1000)) {
    return `Stockout risk ${stockout.delta > 0 ? "+" : ""}${stockout.delta}%`;
  }
  return `Cost ${cost.delta > 0 ? "+" : ""}$${(cost.delta / 1000).toFixed(1)}K`;
}
