import { api } from "./client";

export interface WhatIfParams {
  demandShockPercent: number;
  leadTimeChangePercent: number;
  capacityChangePercent: number;
  serviceLevelTargetPercent: number;
}

export interface SavedScenarioRow {
  id: string;
  name: string;
  description: string | null;
  params: WhatIfParams;
  multipliers: Record<string, number>;
  planningRunCount: number;
  createdAt: string;
  latestRun?: {
    id: string;
    status: string;
    horizonDays: number;
    completedAt: string | null;
  } | null;
}

export interface WhatIfAccepted {
  scenario: SavedScenarioRow;
  run: { id: string; status: string };
  pollAt: string;
}

export const runWhatIf = (body: {
  name: string;
  description?: string;
  horizonDays?: number;
  params: WhatIfParams;
}) => api.post<WhatIfAccepted>("/simulation/run", body);

export const listHistory = (limit = 20) =>
  api.get<SavedScenarioRow[]>("/simulation/history", { limit });

export const listSaved = (limit = 20) =>
  api.get<SavedScenarioRow[]>("/simulation/saved", { limit });

export const saveScenario = (body: {
  name: string;
  description?: string;
  params: WhatIfParams;
}) => api.post<SavedScenarioRow>("/simulation/save", body);

export const deleteScenario = (id: string) =>
  api.delete<void>(`/simulation/saved/${id}`);
