import { api } from "./client";
import { z } from "zod";
import {
  savedScenarioRowSchema,
  whatIfAcceptedSchema,
  type WhatIfParams,
} from "@/schemas/simulation";

export type { SavedScenarioRow, WhatIfAccepted, WhatIfParams } from "@/schemas/simulation";

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

export const runWhatIf = async (body: {
  name: string;
  description?: string;
  horizonDays?: number;
  params: WhatIfRequestParams;
}, warehouse?: string) => whatIfAcceptedSchema.parse(await api.post<unknown>(`/simulation/run${warehouse ? `?warehouseId=${warehouse}` : ""}`, body));

export const listHistory = async (limit = 20, warehouse?: string) =>
  z
    .array(savedScenarioRowSchema)
    .parse(await api.get<unknown>("/simulation/history", { limit, ...(warehouse ? { warehouseId: warehouse } : {}) }));

export const listSaved = async (limit = 20, warehouse?: string) =>
  z.array(savedScenarioRowSchema).parse(await api.get<unknown>("/simulation/saved", { limit, ...(warehouse ? { warehouseId: warehouse } : {}) }));

export const saveScenario = async (body: {
  name: string;
  description?: string;
  params: WhatIfRequestParams;
}, warehouse?: string) => savedScenarioRowSchema.parse(await api.post<unknown>(`/simulation/save${warehouse ? `?warehouseId=${warehouse}` : ""}`, body));

export const deleteScenario = (id: string, warehouse?: string) => api.delete<void>(`/simulation/saved/${id}${warehouse ? `?warehouseId=${warehouse}` : ""}`);
