import type { Request, Response } from "express";
import * as alerts from "../services/alert.service.js";
import { ok, paginated } from "../utils/response.js";
import {
  alertParamsSchema,
  alertQuerySchema,
  alertTrendQuerySchema,
} from "../zod/alert.schemas.js";

export const getAlerts = async (req: Request, res: Response) => {
  const query = alertQuerySchema.parse(req.query);
  const { items, total } = await alerts.listAlerts(query);
  paginated(res, items, query.page, query.pageSize, total);
};

export const getOverview = async (_req: Request, res: Response) => {
  ok(res, await alerts.getOverview());
};

export const getTrends = async (req: Request, res: Response) => {
  ok(res, await alerts.getTrends(alertTrendQuerySchema.parse(req.query)));
};

export const getDistribution = async (_req: Request, res: Response) => {
  ok(res, await alerts.getDistribution());
};

export const getHealth = async (_req: Request, res: Response) => {
  ok(res, await alerts.getHealth());
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
