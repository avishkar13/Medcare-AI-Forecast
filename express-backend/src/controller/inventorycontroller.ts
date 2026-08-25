import type { Request, Response } from "express";
import * as inventory from "../services/inventory.service.js";
import { ok } from "../utils/response.js";
import { inventoryQuerySchema, skuInventoryParamsSchema } from "../zod/inventory.schemas.js";

export const listInventory = async (req: Request, res: Response) => {
  const query = inventoryQuerySchema.parse(req.query);
  const { report, total } = await inventory.listInventory(query);
  ok(res, report, { page: query.page, pageSize: query.pageSize, total });
};

export const getSkuInventory = async (req: Request, res: Response) => {
  const params = skuInventoryParamsSchema.parse(req.params);
  ok(res, await inventory.getSkuInventory(params));
};
