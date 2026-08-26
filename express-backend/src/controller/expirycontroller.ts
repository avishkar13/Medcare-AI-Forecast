import type { Request, Response } from "express";
import * as expiry from "../services/expiry.service.js";
import { ok, paginated } from "../utils/response.js";
import { enforceScopeConflict } from "../middleware/scopeDc.js";
import { expiryBatchQuerySchema, expiryQuerySchema } from "../zod/expiry.schemas.js";

export const getBatches = async (req: Request, res: Response) => {
  const query = expiryBatchQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouse, req);
  const { items, total } = await expiry.listBatches(query, { warehouseId: req.warehouseScope });
  paginated(res, items, query.page, query.pageSize, total);
};

export const getOverview = async (req: Request, res: Response) => {
  const query = expiryQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouse, req);
  ok(res, await expiry.getOverview(query, { warehouseId: req.warehouseScope }));
};

export const getTimeline = async (req: Request, res: Response) => {
  const query = expiryQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouse, req);
  ok(res, await expiry.getTimeline(query, { warehouseId: req.warehouseScope }));
};

export const getExposure = async (req: Request, res: Response) => {
  const query = expiryQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouse, req);
  ok(res, await expiry.getExposure(query, { warehouseId: req.warehouseScope }));
};

export const getDemandCoverage = async (req: Request, res: Response) => {
  const query = expiryQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouse, req);
  ok(res, await expiry.getDemandCoverage(query, { warehouseId: req.warehouseScope }));
};

export const getDcExposure = async (req: Request, res: Response) => {
  const query = expiryQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouse, req);
  ok(res, await expiry.getDcExposure(query, { warehouseId: req.warehouseScope }));
};

export const getAssessment = async (req: Request, res: Response) => {
  const query = expiryQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouse, req);
  ok(res, await expiry.getAssessment(query, { warehouseId: req.warehouseScope }));
};

export const getWastePrevention = async (_req: Request, res: Response) => {
  ok(res, await expiry.listWastePrevention());
};
