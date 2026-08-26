import type { Request, Response } from "express";
import * as masterData from "../services/masterdata.service.js";
import { ok, paginated } from "../utils/response.js";
import { enforceScopeConflict } from "../middleware/scopeDc.js";
import {
  distributorQuerySchema,
  productParamsSchema,
  productQuerySchema,
  promotionQuerySchema,
  warehouseParamsSchema,
  warehouseQuerySchema,
} from "../zod/masterdata.schemas.js";

export const listProducts = async (req: Request, res: Response) => {
  const query = productQuerySchema.parse(req.query);
  const { items, total } = await masterData.listProducts(query);
  paginated(res, items, query.page, query.pageSize, total);
};

export const getProduct = async (req: Request, res: Response) => {
  const params = productParamsSchema.parse(req.params);
  ok(res, await masterData.getProduct(params));
};

export const listWarehouses = async (req: Request, res: Response) => {
  const query = warehouseQuerySchema.parse(req.query);
  ok(res, await masterData.listWarehouses(query, { warehouseId: req.warehouseScope }));
};

export const getWarehouse = async (req: Request, res: Response) => {
  const params = warehouseParamsSchema.parse(req.params);
  enforceScopeConflict(params.id, req);
  ok(res, await masterData.getWarehouse({ id: params.id }));
};

export const listDistributors = async (req: Request, res: Response) => {
  const query = distributorQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouse, req);
  ok(res, await masterData.listDistributors(query, { warehouseId: req.warehouseScope }));
};

export const listPromotions = async (req: Request, res: Response) => {
  const query = promotionQuerySchema.parse(req.query);
  const { items, total } = await masterData.listPromotions(query, { warehouseId: req.warehouseScope });
  paginated(res, items, query.page, query.pageSize, total);
};
