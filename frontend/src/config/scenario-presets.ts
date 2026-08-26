import type { ScenarioPreset, SimulationParams } from "@/types/simulation";

// preset labels and their default slider positions. this is ui config, not a
// simulation: the real run happens on the backend.
export const SCENARIO_PRESETS: Record<ScenarioPreset, { label: string; description: string; params: SimulationParams }> = {
  baseline: {
    label: "Baseline",
    description: "Current network state with no modifications",
    params: { demandShock: 0, inventoryAvailability: 100, serviceLevelTarget: 95, supplierLeadTime: 0, distributionCapacity: 100, transportationCost: 0 },
  },
  "demand-surge": {
    label: "Demand Surge",
    description: "Simulate a sudden increase in product demand",
    params: { demandShock: 40, inventoryAvailability: 100, serviceLevelTarget: 95, supplierLeadTime: 5, distributionCapacity: 100, transportationCost: 10 },
  },
  "supplier-delay": {
    label: "Supplier Delay",
    description: "Model extended supplier lead times",
    params: { demandShock: 0, inventoryAvailability: 85, serviceLevelTarget: 95, supplierLeadTime: 10, distributionCapacity: 100, transportationCost: 25 },
  },
  "inventory-shortage": {
    label: "Inventory Shortage",
    description: "Stress-test with reduced inventory levels",
    params: { demandShock: 15, inventoryAvailability: 65, serviceLevelTarget: 90, supplierLeadTime: 3, distributionCapacity: 100, transportationCost: 0 },
  },
  overstock: {
    label: "Overstock",
    description: "Evaluate excess inventory scenarios",
    params: { demandShock: -20, inventoryAvailability: 115, serviceLevelTarget: 95, supplierLeadTime: 0, distributionCapacity: 100, transportationCost: -10 },
  },
  "combined-stress": {
    label: "Combined Stress",
    description: "Multiple adverse conditions simultaneously",
    params: { demandShock: 50, inventoryAvailability: 70, serviceLevelTarget: 90, supplierLeadTime: 10, distributionCapacity: 80, transportationCost: 50 },
  },
};

export function generateScenarioSummary(preset: ScenarioPreset, params: SimulationParams): string {
  const parts: string[] = [];

  if (params.demandShock > 0) parts.push(`a ${params.demandShock}% demand surge`);
  if (params.demandShock < 0) parts.push(`a ${Math.abs(params.demandShock)}% demand reduction`);
  if (params.supplierLeadTime > 0) parts.push(`+${params.supplierLeadTime} day supplier delays`);
  if (params.inventoryAvailability < 100) parts.push(`${100 - params.inventoryAvailability}% inventory reduction`);
  if (params.inventoryAvailability > 100) parts.push(`${params.inventoryAvailability - 100}% excess inventory`);
  if (params.distributionCapacity < 100) parts.push(`${100 - params.distributionCapacity}% capacity reduction`);
  if (params.transportationCost > 20) parts.push(`elevated transportation costs (+${params.transportationCost}%)`);

  if (parts.length === 0) return "Baseline scenario with no modifications. The network operates under current conditions.";

  const scenario = parts.join(", ");
  const presetLabel = SCENARIO_PRESETS[preset].label;

  return `${presetLabel} scenario simulates ${scenario}. The network may experience increased operational pressure unless proactive measures are taken.`;
}
