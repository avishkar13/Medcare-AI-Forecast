import type { Request, Response } from "express";
import * as expiry from "../services/expiry.service.js";
import { ok, paginated } from "../utils/response.js";
import { expiryBatchQuerySchema, expiryQuerySchema } from "../zod/expiry.schemas.js";

export const getBatches = async (req: Request, res: Response) => {
  const query = expiryBatchQuerySchema.parse(req.query);
  const { items, total } = await expiry.listBatches(query);
  paginated(res, items, query.page, query.pageSize, total);
};

export const getOverview = async (req: Request, res: Response) => {
  ok(res, await expiry.getOverview(expiryQuerySchema.parse(req.query)));
};

export const getTimeline = async (req: Request, res: Response) => {
  ok(res, await expiry.getTimeline(expiryQuerySchema.parse(req.query)));
};

export const getExposure = async (req: Request, res: Response) => {
  ok(res, await expiry.getExposure(expiryQuerySchema.parse(req.query)));
};

export const getDemandCoverage = async (req: Request, res: Response) => {
  ok(res, await expiry.getDemandCoverage(expiryQuerySchema.parse(req.query)));
};

export const getDcExposure = async (req: Request, res: Response) => {
  ok(res, await expiry.getDcExposure(expiryQuerySchema.parse(req.query)));
};

export const getAssessment = async (req: Request, res: Response) => {
  ok(res, await expiry.getAssessment(expiryQuerySchema.parse(req.query)));
};

export const getWastePrevention = async (_req: Request, res: Response) => {
  ok(res, await expiry.listWastePrevention());
};
