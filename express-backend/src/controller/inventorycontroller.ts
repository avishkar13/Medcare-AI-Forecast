import type { Request, Response } from "express";
import * as inventory from "../services/inventory.service.js";
import { ok } from "../utils/response.js";
import { enforceScopeConflict } from "../middleware/scopeDc.js";
import { inventoryQuerySchema, skuInventoryParamsSchema } from "../zod/inventory.schemas.js";

export const listInventory = async (req: Request, res: Response) => {
  const query = inventoryQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouse, req);
  const { report, total } = await inventory.listInventory(query, { warehouseId: req.warehouseScope });
  ok(res, report, { page: query.page, pageSize: query.pageSize, total });
};

export const getSkuInventory = async (req: Request, res: Response) => {
  const params = skuInventoryParamsSchema.parse(req.params);
  // enforceScopeConflict for single SKU isn't typically possible without query params, but the service handles the authScope filtering.
  ok(res, await inventory.getSkuInventory(params, { warehouseId: req.warehouseScope }));
};
