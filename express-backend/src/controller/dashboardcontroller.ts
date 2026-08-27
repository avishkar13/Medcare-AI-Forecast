import type { Request, Response } from "express";
import * as dashboard from "../services/dashboard.service.js";
import { ok } from "../utils/response.js";
import {
  expiryRiskQuerySchema,
  inventoryHealthQuerySchema,
  networkQuerySchema,
  priorityActionsQuerySchema,
  summaryQuerySchema,
} from "../zod/dashboard.schemas.js";

import { enforceScopeConflict } from "../middleware/scopeDc.js";

/**
 * The DC a request is answered for.
 *
 * `enforceScopeConflict` has already rejected a confined caller asking for someone
 * else's DC, so by the time this runs the two either agree or the caller is
 * network-wide and only the query narrows.
 */
const scopeOf = (req: Request, requested?: string) => ({
  warehouseId: req.warehouseScope ?? requested ?? null,
});

export const summary = async (req: Request, res: Response) => {
  const query = summaryQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouseId, req);
  ok(res, await dashboard.getSummary(scopeOf(req, query.warehouseId)));
};

export const network = async (req: Request, res: Response) => {
  const query = networkQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouseId, req);
  ok(res, await dashboard.getNetwork(query, scopeOf(req, query.warehouseId)));
};

export const inventoryHealth = async (req: Request, res: Response) => {
  const query = inventoryHealthQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouseId, req);
  ok(res, await dashboard.getInventoryHealth(query, scopeOf(req, query.warehouseId)));
};

export const expiryRisk = async (req: Request, res: Response) => {
  const query = expiryRiskQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouseId, req);
  const report = await dashboard.getExpiryRisk(query, scopeOf(req, query.warehouseId));
  ok(res, report, { page: query.page, pageSize: query.pageSize, total: report.totals.batchCount });
};

export const priorityActions = async (req: Request, res: Response) => {
  const query = priorityActionsQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouseId, req);
  ok(res, await dashboard.getPriorityActions(query, scopeOf(req, query.warehouseId)));
};
