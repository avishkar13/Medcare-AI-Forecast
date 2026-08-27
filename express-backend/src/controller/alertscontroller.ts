import type { Request, Response } from "express";
import * as alerts from "../services/alert.service.js";
import * as notifications from "../services/notification.service.js";
import { refreshAlerts } from "../services/alert-detector.service.js";
import { ok, paginated } from "../utils/response.js";
import {
  alertParamsSchema,
  alertQuerySchema,
  alertTrendQuerySchema,
  deliveryQuerySchema,
} from "../zod/alert.schemas.js";

import { enforceScopeConflict } from "../middleware/scopeDc.js";

export const getAlerts = async (req: Request, res: Response) => {
  const query = alertQuerySchema.parse(req.query);
  // Guarded on the id, not `location`. `location` is a display name and would never
  // equal a warehouse id, so guarding it 403d a confined caller filtering by the name
  // of their own DC.
  enforceScopeConflict(query.warehouseId, req);
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

export const getDeliveries = async (req: Request, res: Response) => {
  const query = deliveryQuerySchema.parse(req.query);
  const { items, total } = await notifications.listDeliveries(query);
  paginated(res, items, query.page, query.pageSize, total);
};

/**
 * Detection on demand.
 *
 * Answered synchronously rather than 202-and-poll: a cycle is seconds, and the caller
 * is a planner who pressed Refresh and expects the table to have moved when it
 * returns. A planning run is the opposite shape and keeps its 202.
 */
export const refresh = async (_req: Request, res: Response) => {
  ok(res, await refreshAlerts());
};

export const testNotification = async (_req: Request, res: Response) => {
  ok(res, await notifications.sendTestNotification());
};
