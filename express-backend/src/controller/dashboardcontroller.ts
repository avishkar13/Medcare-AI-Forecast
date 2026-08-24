import type { Request, Response } from "express";
import * as dashboard from "../services/dashboard.service.js";
import { ok } from "../utils/response.js";
import {
  expiryRiskQuerySchema,
  inventoryHealthQuerySchema,
  networkQuerySchema,
  priorityActionsQuerySchema,
} from "../zod/dashboard.schemas.js";

export const summary = async (_req: Request, res: Response) => {
  ok(res, await dashboard.getSummary());
};

export const network = async (req: Request, res: Response) => {
  const query = networkQuerySchema.parse(req.query);
  ok(res, await dashboard.getNetwork(query));
};

export const inventoryHealth = async (req: Request, res: Response) => {
  const query = inventoryHealthQuerySchema.parse(req.query);
  ok(res, await dashboard.getInventoryHealth(query));
};

export const expiryRisk = async (req: Request, res: Response) => {
  const query = expiryRiskQuerySchema.parse(req.query);
  const report = await dashboard.getExpiryRisk(query);
  ok(res, report, { page: query.page, pageSize: query.pageSize, total: report.totals.batchCount });
};

export const priorityActions = async (req: Request, res: Response) => {
  const query = priorityActionsQuerySchema.parse(req.query);
  ok(res, await dashboard.getPriorityActions(query));
};
