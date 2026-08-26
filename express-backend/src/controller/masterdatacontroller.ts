import type { Request, Response } from "express";
import * as masterData from "../services/masterdata.service.js";
import { ok, paginated } from "../utils/response.js";
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
  ok(res, await masterData.listWarehouses(query));
};

export const getWarehouse = async (req: Request, res: Response) => {
  ok(res, await masterData.getWarehouse(warehouseParamsSchema.parse(req.params)));
};

export const listDistributors = async (req: Request, res: Response) => {
  ok(res, await masterData.listDistributors(distributorQuerySchema.parse(req.query)));
};

export const listPromotions = async (req: Request, res: Response) => {
  const query = promotionQuerySchema.parse(req.query);
  const { items, total } = await masterData.listPromotions(query);
  paginated(res, items, query.page, query.pageSize, total);
};
