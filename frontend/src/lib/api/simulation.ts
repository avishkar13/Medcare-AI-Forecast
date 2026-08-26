import { api } from "./client";

export interface WhatIfParams {
  demandShockPercent: number;
  leadTimeChangePercent: number;
  capacityChangePercent: number;
  serviceLevelTargetPercent: number;
}

// a day delta the server converts against the network's real average lead time, so
// nothing here has to carry a nominal figure of its own
export interface LeadTimeDays {
  leadTimeChangeDays?: number;
}

// the server fills capacity and service level from its own defaults, so a caller that
// only moves demand and lead time does not have to restate them
export type WhatIfRequestParams = Pick<WhatIfParams, "demandShockPercent"> &
  Partial<WhatIfParams> &
  LeadTimeDays;

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
  params: WhatIfRequestParams;
}) => api.post<WhatIfAccepted>("/simulation/run", body);

export const listHistory = (limit = 20) =>
  api.get<SavedScenarioRow[]>("/simulation/history", { limit });

export const listSaved = (limit = 20) =>
  api.get<SavedScenarioRow[]>("/simulation/saved", { limit });

export const saveScenario = (body: {
  name: string;
  description?: string;
  params: WhatIfRequestParams;
}) => api.post<SavedScenarioRow>("/simulation/save", body);

export const deleteScenario = (id: string) =>
  api.delete<void>(`/simulation/saved/${id}`);
