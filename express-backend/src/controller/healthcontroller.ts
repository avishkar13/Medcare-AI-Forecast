import type { Request, Response } from "express";
import { checkReadiness } from "../services/health.service.js";

export const live = (_req: Request, res: Response) => {
  res.json({ status: "ok" });
};

export const ready = async (_req: Request, res: Response) => {
  const report = await checkReadiness();
  res.status(report.status === "ok" ? 200 : 503).json(report);
};
