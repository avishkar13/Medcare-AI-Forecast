import type { Request, Response } from "express";
import * as masterData from "../services/masterdata.service.js";
import { ok, paginated } from "../utils/response.js";
import {
  productParamsSchema,
  productQuerySchema,
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
