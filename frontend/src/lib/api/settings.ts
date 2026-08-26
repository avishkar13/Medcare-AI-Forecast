import { api } from "./client";
import type { AppSettings } from "@/types/settings";

export const getSettings = () => api.get<AppSettings>("/settings");

// the server deep-merges, so a patch carries only what changed
export const updateSettings = (patch: Partial<AppSettings>) =>
  api.patch<AppSettings>("/settings", patch);
