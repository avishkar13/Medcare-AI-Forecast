import type { Request, Response } from "express";
import * as alerts from "../services/alert.service.js";
import { ok, paginated } from "../utils/response.js";
import {
  alertParamsSchema,
  alertQuerySchema,
  alertTrendQuerySchema,
} from "../zod/alert.schemas.js";

import { enforceScopeConflict } from "../middleware/scopeDc.js";

export const getAlerts = async (req: Request, res: Response) => {
  const query = alertQuerySchema.parse(req.query);
  enforceScopeConflict(query.location, req); // We can't strictly compare name vs ID here, but if the frontend sends the ID by mistake it throws. The service enforces the real scope.
  const { items, total } = await alerts.listAlerts(query, { warehouseId: req.warehouseScope });
  paginated(res, items, query.page, query.pageSize, total);
};

export const getOverview = async (req: Request, res: Response) => {
  ok(res, await alerts.getOverview({ warehouseId: req.warehouseScope }));
};

export const getTrends = async (req: Request, res: Response) => {
  ok(res, await alerts.getTrends(alertTrendQuerySchema.parse(req.query), { warehouseId: req.warehouseScope }));
};

export const getDistribution = async (req: Request, res: Response) => {
  ok(res, await alerts.getDistribution({ warehouseId: req.warehouseScope }));
};

export const getHealth = async (req: Request, res: Response) => {
  ok(res, await alerts.getHealth({ warehouseId: req.warehouseScope }));
};

export const acknowledge = async (req: Request, res: Response) => {
  ok(res, await alerts.acknowledgeAlert(alertParamsSchema.parse(req.params)));
};

export const resolve = async (req: Request, res: Response) => {
  ok(res, await alerts.resolveAlert(alertParamsSchema.parse(req.params)));
};

export const markAllRead = async (_req: Request, res: Response) => {
  ok(res, await alerts.markAllRead());
};
