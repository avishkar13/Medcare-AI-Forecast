import type { Request, Response } from "express";
import * as dashboard from "../services/dashboard.service.js";
import { ok } from "../utils/response.js";

export const summary = async (_req: Request, res: Response) => {
  ok(res, await dashboard.getSummary());
};
