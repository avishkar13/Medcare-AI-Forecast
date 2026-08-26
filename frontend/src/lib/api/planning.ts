import { api } from "./client";

export interface PlanningRun {
  id: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  horizonDays: number;
  modelVersion: string | null;
  scenario: { id: string; name: string } | null;
  createdAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
  stale: boolean;
  failureReason: string | null;
  failureStage: string | null;
  currentStage: string | null;
  progress: number | null;
}

export interface Delta {
  baseline: number;
  scenario: number;
  delta: number;
  percentChange: number | null;
}

export interface RunComparison {
  scenario: { id: string; horizonDays: number };
  baseline: { id: string; horizonDays: number };
  headline: {
    stockoutDaysAvoided: number;
    writeOffUnitsAvoided: number;
    costSaved: number;
    serviceLevelChange: number;
    transfersProposed: number;
  };
  cost: Record<"holding" | "stockout" | "transfer" | "expiry" | "total", Delta>;
  risk: Record<string, Delta>;
  plan: Record<string, Delta>;
  warnings: string[];
}

export const listRuns = (params?: { status?: string; pageSize?: number }) =>
  api.getPage<PlanningRun[]>("/planning/runs", params);

export const compareRuns = (id: string, baseline: string) =>
  api.get<RunComparison>(`/planning/runs/${id}/compare`, { baseline });

export interface RunSimulation {
  planningRunId: string;
  iterations: number;
  serviceLevel: number;
  stockoutProbability: number;
  expiryProbability: number;
  expectedInventory: number;
  expectedWaste: number;
  expectedCost: number;
}

export interface RunOptimization {
  planningRunId: string;
  totalCost: number;
  holdingCost: number;
  stockoutCost: number;
  transferCost: number;
  expiryCost: number;
  componentSum: number;
  solver: string;
}

export const getRun = (id: string) => api.get<PlanningRun>(`/planning/runs/${id}`);

export const getRunSimulation = (id: string) =>
  api.get<RunSimulation>(`/planning/runs/${id}/simulation`);

export const getRunOptimization = (id: string) =>
  api.get<RunOptimization>(`/planning/runs/${id}/optimization`);
