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
}) => whatIfAcceptedSchema.parse(await api.post<unknown>("/simulation/run", body));

export const listHistory = async (limit = 20) =>
  z
    .array(savedScenarioRowSchema)
    .parse(await api.get<unknown>("/simulation/history", { limit }));

export const listSaved = async (limit = 20) =>
  z.array(savedScenarioRowSchema).parse(await api.get<unknown>("/simulation/saved", { limit }));

export const saveScenario = async (body: {
  name: string;
  description?: string;
  params: WhatIfRequestParams;
}) => savedScenarioRowSchema.parse(await api.post<unknown>("/simulation/save", body));

export const deleteScenario = (id: string) => api.delete<void>(`/simulation/saved/${id}`);
