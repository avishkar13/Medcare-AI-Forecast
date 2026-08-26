import type { Request, Response } from "express";
import * as recommendations from "../services/recommendation.service.js";
import { ok, paginated } from "../utils/response.js";
import {
  recommendationParamsSchema,
  recommendationQuerySchema,
} from "../zod/recommendation.schemas.js";

import { enforceScopeConflict } from "../middleware/scopeDc.js";

export const getList = async (req: Request, res: Response) => {
  const query = recommendationQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouse, req);
  const { items, total } = await recommendations.listRecommendations(query, { warehouseId: req.warehouseScope });
  paginated(res, items, query.page, query.pageSize, total);
};

export const getKpi = async (req: Request, res: Response) => {
  const query = recommendationQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouse, req);
  ok(res, await recommendations.getKpi(query, { warehouseId: req.warehouseScope }));
};

export const getSummary = async (req: Request, res: Response) => {
  const query = recommendationQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouse, req);
  ok(res, await recommendations.getSummary(query, { warehouseId: req.warehouseScope }));
};

export const getImpact = async (req: Request, res: Response) => {
  const query = recommendationQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouse, req);
  ok(res, await recommendations.getImpact(query, { warehouseId: req.warehouseScope }));
};

export const getIntelligence = async (req: Request, res: Response) => {
  const query = recommendationQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouse, req);
  ok(res, await recommendations.getIntelligence(query, { warehouseId: req.warehouseScope }));
};

export const execute = async (req: Request, res: Response) => {
  const params = recommendationParamsSchema.parse(req.params);
  ok(res, await recommendations.executeRecommendation(params, req.userId));
};

export const dismiss = async (req: Request, res: Response) => {
  const params = recommendationParamsSchema.parse(req.params);
  ok(res, await recommendations.dismissRecommendation(params, req.userId));
};
