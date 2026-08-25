import type { Request, Response } from "express";
import * as forecast from "../services/forecastread.service.js";
import { ok } from "../utils/response.js";
import {
  forecastChartQuerySchema,
  forecastQuerySchema,
} from "../zod/forecastread.schemas.js";

/**
 * Controllers parse, delegate and shape. They never catch: Express 5 forwards a
 * rejected promise to `errorHandler`, which owns the error envelope.
 */

export const getKpi = async (req: Request, res: Response) => {
  ok(res, await forecast.getKpi(forecastQuerySchema.parse(req.query)));
};

export const getSummary = async (req: Request, res: Response) => {
  ok(res, await forecast.getSummary(forecastQuerySchema.parse(req.query)));
};

export const getMainChart = async (req: Request, res: Response) => {
  ok(res, await forecast.getMainChart(forecastChartQuerySchema.parse(req.query)));
};

export const getTrend = async (req: Request, res: Response) => {
  ok(res, await forecast.getTrend(forecastQuerySchema.parse(req.query)));
};

export const getSeasonality = async (req: Request, res: Response) => {
  ok(res, await forecast.getSeasonality(forecastQuerySchema.parse(req.query)));
};

export const getNetwork = async (req: Request, res: Response) => {
  ok(res, await forecast.getNetwork(forecastQuerySchema.parse(req.query)));
};

export const getSkus = async (req: Request, res: Response) => {
  ok(res, await forecast.getSkus(forecastQuerySchema.parse(req.query)));
};

export const getPerformance = async (req: Request, res: Response) => {
  ok(res, await forecast.getPerformance(forecastQuerySchema.parse(req.query)));
};

export const getImpact = async (req: Request, res: Response) => {
  ok(res, await forecast.getImpact(forecastQuerySchema.parse(req.query)));
};

export const getInsight = async (req: Request, res: Response) => {
  ok(res, await forecast.getInsight(forecastQuerySchema.parse(req.query)));
};
