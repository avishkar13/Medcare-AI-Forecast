import type { Request, Response } from "express";
import * as dashboard from "../services/dashboard.service.js";
import { ok } from "../utils/response.js";
import {
  expiryRiskQuerySchema,
  inventoryHealthQuerySchema,
  networkQuerySchema,
  priorityActionsQuerySchema,
} from "../zod/dashboard.schemas.js";

import { enforceScopeConflict } from "../middleware/scopeDc.js";

export const summary = async (req: Request, res: Response) => {
  ok(res, await dashboard.getSummary({ warehouseId: req.warehouseScope }));
};

export const network = async (req: Request, res: Response) => {
  const query = networkQuerySchema.parse(req.query);
  ok(res, await dashboard.getNetwork(query, { warehouseId: req.warehouseScope }));
};

export const inventoryHealth = async (req: Request, res: Response) => {
  const query = inventoryHealthQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouseId, req);
  ok(res, await dashboard.getInventoryHealth(query, { warehouseId: req.warehouseScope }));
};

export const expiryRisk = async (req: Request, res: Response) => {
  const query = expiryRiskQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouseId, req);
  const report = await dashboard.getExpiryRisk(query, { warehouseId: req.warehouseScope });
  ok(res, report, { page: query.page, pageSize: query.pageSize, total: report.totals.batchCount });
};

export const priorityActions = async (req: Request, res: Response) => {
  const query = priorityActionsQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouseId, req);
  ok(res, await dashboard.getPriorityActions(query, { warehouseId: req.warehouseScope }));
};
