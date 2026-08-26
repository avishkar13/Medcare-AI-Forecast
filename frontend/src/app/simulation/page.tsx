"use client";

import { useState, useCallback } from "react";
import { ScenarioPreset, SimulationParams, SimulationOutput, SavedScenario, SimulationHistoryItem } from "@/types/simulation";
import { SCENARIO_PRESETS, generateScenarioSummary } from "@/config/scenario-presets";
import {
  useSavedScenarios,
  useScenarioMutations,
  useSimulationHistory,
  useWhatIf,
} from "@/hooks/use-simulation";
import { toSimulationOutput, toWhatIfParams } from "@/lib/simulation-mapping";

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
  const whatIf = useWhatIf();
  const historyQuery = useSimulationHistory();
  const savedQuery = useSavedScenarios();
  const { save } = useScenarioMutations();

  const [lastSimulation, setLastSimulation] = useState<string | null>(null);

  const isSimulating = whatIf.isRunning;
  // results exist only once a run has completed; nothing is shown before that
  const results: SimulationOutput | null = toSimulationOutput(
    whatIf.simulation,
    whatIf.optimization,
    whatIf.comparison,
  );
  const hasResults = results !== null;

  const savedScenarios: SavedScenario[] = (savedQuery.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    preset: "baseline" as ScenarioPreset,
    params: {
      demandShock: row.params.demandShockPercent,
      inventoryAvailability: 100,
      serviceLevelTarget: row.params.serviceLevelTargetPercent,
      supplierLeadTime: 0,
      distributionCapacity: 100 + row.params.capacityChangePercent,
      transportationCost: 0,
    },
    metrics: [],
    riskLevel: "moderate",
    date: row.createdAt,
  }));

  const history: SimulationHistoryItem[] = (historyQuery.data ?? []).map((row) => ({
    id: row.id,
    scenario: row.name,
    preset: "baseline" as ScenarioPreset,
    date: row.createdAt,
    keyChange: `Demand ${row.params.demandShockPercent >= 0 ? "+" : ""}${row.params.demandShockPercent}%`,
    riskLevel: "moderate",
    resultSummary: row.latestRun?.status ?? "",
    params: {
      demandShock: row.params.demandShockPercent,
      inventoryAvailability: 100,
      serviceLevelTarget: row.params.serviceLevelTargetPercent,
      supplierLeadTime: 0,
      distributionCapacity: 100 + row.params.capacityChangePercent,
      transportationCost: 0,
    },
  }));
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

  // a what-if creates a scenario and a real planning run; results arrive by polling
  const handleRun = useCallback(() => {
    whatIf.start.mutate({
      name: `${SCENARIO_PRESETS[preset].label} ${new Date().toISOString().slice(11, 16)}`,
      horizonDays: 14,
      params: toWhatIfParams(params),
    });
    setLastSimulation(
      new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
    );
  }, [preset, params, whatIf.start]);

  const handleReset = useCallback(() => {
    const baselineParams = SCENARIO_PRESETS.baseline.params;
    setPreset("baseline");
    setParams(baselineParams);
    setSummary(generateScenarioSummary("baseline", baselineParams));
  }, []);

  const handleResetParams = useCallback(() => {
    const presetParams = SCENARIO_PRESETS[preset].params;
    setParams(presetParams);
    setSummary(generateScenarioSummary(preset, presetParams));
  }, [preset]);

  const handleSaveCurrent = useCallback(() => {
    save.mutate({
      name: `${SCENARIO_PRESETS[preset].label} ${new Date().toISOString().slice(0, 16)}`,
      params: toWhatIfParams(params),
    });
  }, [preset, params, save]);

  const handleApplyScenario = useCallback((scenario: SavedScenario) => {
    setPreset(scenario.preset);
    setParams(scenario.params);
    setSummary(generateScenarioSummary(scenario.preset, scenario.params));
  }, []);

  const handleViewHistory = useCallback((item: SimulationHistoryItem) => {
    setPreset(item.preset);
    setParams(item.params);
    setSummary(generateScenarioSummary(item.preset, item.params));
  }, []);

  // AI interpretation for risk section
  const riskInterpretation = results?.aiInsight.overallRisk === "critical"
    ? "Under this scenario, stockout risk becomes the dominant operational risk. Distribution centers may exceed capacity and additional replenishment should be considered."
    : results?.aiInsight.overallRisk === "high"
    ? "The simulated scenario creates elevated risk across multiple dimensions. Proactive inventory repositioning is recommended."
    : results?.aiInsight.overallRisk === "moderate"
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