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

export const getKpi = async (_req: Request, res: Response) => {
  res.json({
    totalInventoryValue: 1245000,
    totalSkus: 845,
    inStockRate: 96.5,
    atRiskSkus: 12,
    atRiskCritical: 4,
    excessInventoryValue: 45000
  });
};

export const getHealth = async (_req: Request, res: Response) => {
  res.json({
    healthy: 612,
    belowReorderPoint: 98,
    criticalStock: 42,
    excessStock: 58,
    expiringSoon: 35,
    total: 845
  });
};

export const getNetwork = async (_req: Request, res: Response) => {
  res.json([
    {
      id: "DC-01",
      name: "Northeast DC",
      capacity: 500000,
      utilization: 88.5,
      inventoryValue: 450000,
      atRiskInventory: 12500,
      stockoutRisk: 4.2
    }
  ]);
};
