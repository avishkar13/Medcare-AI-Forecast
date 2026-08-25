import type { Request, Response } from "express";
import * as settings from "../services/settings.service.js";
import { ok } from "../utils/response.js";
import { settingsPatchSchema } from "../zod/settings.schemas.js";

export const getSettings = async (_req: Request, res: Response) => {
  ok(res, await settings.getSettings());
};

export const updateSettings = async (req: Request, res: Response) => {
  const patch = settingsPatchSchema.parse(req.body ?? {});
  ok(res, await settings.updateSettings(patch));
};

export const replaceSettings = async (req: Request, res: Response) => {
  // PUT resets to defaults first, then applies the body, so it is a true replace
  // rather than a PATCH wearing a different verb.
  await settings.resetSettings();
  const patch = settingsPatchSchema.parse(req.body ?? {});
  ok(res, await settings.updateSettings(patch));
};
