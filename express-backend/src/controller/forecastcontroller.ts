import type { Request, Response } from "express";
import * as accuracy from "../services/forecast-accuracy.service.js";
import * as forecast from "../services/forecastread.service.js";
import { ok } from "../utils/response.js";
import { enforceScopeConflict } from "../middleware/scopeDc.js";
import { accuracyQuerySchema } from "../zod/accuracy.schemas.js";
import {
  forecastChartQuerySchema,
  forecastQuerySchema,
} from "../zod/forecastread.schemas.js";

/**
 * Controllers parse, delegate and shape. They never catch: Express 5 forwards a
 * rejected promise to `errorHandler`, which owns the error envelope.
 */

export const getKpi = async (req: Request, res: Response) => {
  const query = forecastQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouse, req);
  ok(res, await forecast.getKpi(query, { warehouseId: req.warehouseScope }));
};

export const getSummary = async (req: Request, res: Response) => {
  const query = forecastQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouse, req);
  ok(res, await forecast.getSummary(query, { warehouseId: req.warehouseScope }));
};

export const getMainChart = async (req: Request, res: Response) => {
  const query = forecastChartQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouse, req);
  ok(res, await forecast.getMainChart(query, { warehouseId: req.warehouseScope }));
};

export const getTrend = async (req: Request, res: Response) => {
  const query = forecastQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouse, req);
  ok(res, await forecast.getTrend(query, { warehouseId: req.warehouseScope }));
};

export const getSeasonality = async (req: Request, res: Response) => {
  const query = forecastQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouse, req);
  ok(res, await forecast.getSeasonality(query, { warehouseId: req.warehouseScope }));
};

export const getNetwork = async (req: Request, res: Response) => {
  const query = forecastQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouse, req);
  ok(res, await forecast.getNetwork(query, { warehouseId: req.warehouseScope }));
};

export const getSkus = async (req: Request, res: Response) => {
  const query = forecastQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouse, req);
  ok(res, await forecast.getSkus(query, { warehouseId: req.warehouseScope }));
};

export const getPerformance = async (req: Request, res: Response) => {
  const query = forecastQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouse, req);
  ok(res, await forecast.getPerformance(query, { warehouseId: req.warehouseScope }));
};

export const getImpact = async (req: Request, res: Response) => {
  const query = forecastQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouse, req);
  ok(res, await forecast.getImpact(query, { warehouseId: req.warehouseScope }));
};

export const getInsight = async (req: Request, res: Response) => {
  const query = forecastQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouse, req);
  ok(res, await forecast.getInsight(query, { warehouseId: req.warehouseScope }));
};

export const getAccuracy = async (req: Request, res: Response) => {
  const query = accuracyQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouse, req);
  ok(res, await accuracy.getAccuracy(query, { warehouseId: req.warehouseScope }));
};
