import type { Request, Response } from "express";
import * as alerts from "../services/alert.service.js";
import * as notifications from "../services/notification.service.js";
import { refreshAlerts } from "../services/alert-detector.service.js";
import { ok, paginated } from "../utils/response.js";
import {
  alertParamsSchema,
  alertQuerySchema,
  alertScopeQuerySchema,
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

/**
 * The caller's own assignment wins over the query, exactly as it does on the list: a
 * confined user must not be able to widen, but an unconfined one has to be able to
 * narrow. These three read no query at all before, so they answered network-wide
 * beside a list that was correctly filtered.
 */
const scopeOf = (requested: string | undefined, req: Request) => {
  enforceScopeConflict(requested, req);
  const warehouseId = req.warehouseScope ?? requested;
  // `exactOptionalPropertyTypes` is on: an absent scope must omit the key rather than
  // set it to undefined, or it stops matching `{ warehouseId?: string | null }`.
  return warehouseId === undefined ? {} : { warehouseId };
};

export const getOverview = async (req: Request, res: Response) => {
  const { warehouseId } = alertScopeQuerySchema.parse(req.query);
  ok(res, await alerts.getOverview(scopeOf(warehouseId, req)));
};

export const getTrends = async (req: Request, res: Response) => {
  const query = alertTrendQuerySchema.parse(req.query);
  ok(res, await alerts.getTrends(query, scopeOf(query.warehouseId, req)));
};

export const getDistribution = async (req: Request, res: Response) => {
  const { warehouseId } = alertScopeQuerySchema.parse(req.query);
  ok(res, await alerts.getDistribution(scopeOf(warehouseId, req)));
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
