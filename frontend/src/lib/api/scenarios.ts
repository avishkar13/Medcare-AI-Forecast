import { api } from "./client";
import type { QueryParams } from "./types";
import { scenarioSchema, type Scenario } from "@/schemas/scenarios";

export type { Scenario } from "@/schemas/scenarios";

export interface ScenarioListParams extends QueryParams {
  page?: number;
  pageSize?: number;
}

export interface CreateScenarioBody {
  name: string;
  description?: string;
  demandMultiplier?: number;
  leadTimeMultiplier?: number;
  capacityMultiplier?: number;
  /** Omit to let each pair use its own configured service level. */
  serviceLevelTarget?: number;
}

/**
 * A list is validated per row and bad rows are dropped rather than failing the page.
 */
const parseList = (rows: unknown): Scenario[] => {
  if (!Array.isArray(rows)) return [];

  const parsed: Scenario[] = [];
  for (const row of rows) {
    const result = scenarioSchema.safeParse(row);
    if (result.success) parsed.push(result.data);
    else console.error("dropped a scenario that did not match the contract", result.error.issues);
  }
  return parsed;
};

export const listScenarios = async (params?: ScenarioListParams) => {
  const page = await api.getPage<unknown>("/scenarios", params);
  return { ...page, data: parseList(page.data) };
};

export const getScenario = async (id: string) =>
  scenarioSchema.parse(await api.get<unknown>(`/scenarios/${id}`));

export const createScenario = async (body: CreateScenarioBody) =>
  scenarioSchema.parse(await api.post<unknown>("/scenarios", body));
