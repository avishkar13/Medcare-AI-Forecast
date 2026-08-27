import { api } from "./client";
import { appSettingsSchema } from "@/schemas/settings";
import type { AppSettings } from "@/types/settings";

export const getSettings = async (): Promise<AppSettings> =>
  appSettingsSchema.parse(await api.get<unknown>("/settings")) as AppSettings;

// the server deep-merges, so a patch carries only what changed
export const updateSettings = async (patch: Partial<AppSettings>): Promise<AppSettings> =>
  appSettingsSchema.parse(await api.patch<unknown>("/settings", patch)) as AppSettings;
