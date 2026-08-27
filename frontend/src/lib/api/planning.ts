import { api } from "./client";
import type { QueryParams } from "./types";
import {
  planningRunSchema,
  runComparisonSchema,
  runOptimizationSchema,
  runSimulationSchema,
  type PlanningRun,
} from "@/schemas/planning";

export type {
  Delta,
  PlanningRun,
  PlanningRunStatus,
  RunComparison,
  RunOptimization,
  RunSimulation,
} from "@/schemas/planning";

export interface PlanningRunListParams extends QueryParams {
  status?: string;
  page?: number;
  pageSize?: number;
}

/**
 * A list is validated per row and bad rows are dropped rather than failing the page.
 */
const parseRuns = (rows: unknown): PlanningRun[] => {
  if (!Array.isArray(rows)) return [];

  const parsed: PlanningRun[] = [];
  for (const row of rows) {
    const result = planningRunSchema.safeParse(row);
    if (result.success) parsed.push(result.data);
    else console.error("dropped a planning run that did not match the contract", result.error.issues);
  }
  return parsed;
};

export const listRuns = async (params?: PlanningRunListParams) => {
  const page = await api.getPage<unknown>("/planning/runs", params);
  return { ...page, data: parseRuns(page.data) };
};

export const getRun = async (id: string) =>
  planningRunSchema.parse(await api.get<unknown>(`/planning/runs/${id}`));

export const compareRuns = async (id: string, baseline: string) =>
  runComparisonSchema.parse(
    await api.get<unknown>(`/planning/runs/${id}/compare`, { baseline }),
  );

export const getRunSimulation = async (id: string) =>
  runSimulationSchema.parse(await api.get<unknown>(`/planning/runs/${id}/simulation`));

export const getRunOptimization = async (id: string) =>
  runOptimizationSchema.parse(await api.get<unknown>(`/planning/runs/${id}/optimization`));

/**
 * Starts a run. Answers `202` with the run to poll - it does not wait for completion.
 * Phase 5 gives this its first caller; the module is built now so the contract is
 * parsed the same way as every other.
 */
export const createRun = async (body?: {
  horizonDays?: number;
  scenarioId?: string;
}) => planningRunSchema.parse(await api.post<unknown>("/planning/runs", body ?? {}));
