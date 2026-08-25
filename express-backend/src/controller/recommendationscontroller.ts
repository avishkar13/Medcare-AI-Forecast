import type { Request, Response } from "express";
import * as recommendations from "../services/recommendation.service.js";
import { ok, paginated } from "../utils/response.js";
import {
  recommendationParamsSchema,
  recommendationQuerySchema,
} from "../zod/recommendation.schemas.js";

export const getList = async (req: Request, res: Response) => {
  const query = recommendationQuerySchema.parse(req.query);
  const { items, total } = await recommendations.listRecommendations(query);
  paginated(res, items, query.page, query.pageSize, total);
};

export const getKpi = async (req: Request, res: Response) => {
  ok(res, await recommendations.getKpi(recommendationQuerySchema.parse(req.query)));
};

export const getSummary = async (req: Request, res: Response) => {
  ok(res, await recommendations.getSummary(recommendationQuerySchema.parse(req.query)));
};

export const getImpact = async (req: Request, res: Response) => {
  ok(res, await recommendations.getImpact(recommendationQuerySchema.parse(req.query)));
};

export const getIntelligence = async (req: Request, res: Response) => {
  ok(res, await recommendations.getIntelligence(recommendationQuerySchema.parse(req.query)));
};

export const execute = async (req: Request, res: Response) => {
  const params = recommendationParamsSchema.parse(req.params);
  ok(res, await recommendations.executeRecommendation(params));
};

export const dismiss = async (req: Request, res: Response) => {
  const params = recommendationParamsSchema.parse(req.params);
  ok(res, await recommendations.dismissRecommendation(params));
};
