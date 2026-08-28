import type { Request, Response } from "express";
import * as plans from "../services/plans.service.js";
import { ok } from "../utils/response.js";
import { enforceScopeConflict } from "../middleware/scopeDc.js";
import { drpQuerySchema, planParamsSchema, supplyPlanQuerySchema } from "../zod/plans.schemas.js";

export const listSupplyPlans = async (req: Request, res: Response) => {
  const query = supplyPlanQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouse, req);
  const { items, total, planningRunId } = await plans.listSupplyPlans(query, { warehouseId: req.warehouseScope });
  // Which run these plans came from travels with them, so a page cannot show one
  // run's orders under another run's heading.
  ok(res, items, { page: query.page, pageSize: query.pageSize, total, planningRunId });
};

export const approveSupplyPlan = async (req: Request, res: Response) => {
  const { id } = planParamsSchema.parse(req.params);
  ok(res, await plans.decideSupplyPlan(id, "approve"));
};

export const rejectSupplyPlan = async (req: Request, res: Response) => {
  const { id } = planParamsSchema.parse(req.params);
  ok(res, await plans.decideSupplyPlan(id, "reject"));
};

export const approveDrpPlan = async (req: Request, res: Response) => {
  const { id } = planParamsSchema.parse(req.params);
  ok(res, await plans.decideDrpPlan(id, "approve"));
};

export const rejectDrpPlan = async (req: Request, res: Response) => {
  const { id } = planParamsSchema.parse(req.params);
  ok(res, await plans.decideDrpPlan(id, "reject"));
};

export const listDrpPlans = async (req: Request, res: Response) => {
  const query = drpQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouse, req);
  const { items, total, totalUnits, planningRunId } = await plans.listDrpPlans(query, { warehouseId: req.warehouseScope });
  // `totalUnits` is the whole filtered set, not this page - a planner asking "how
  // much is moving" should not have to add up every page to find out.
  ok(res, { items, totalUnits }, {
    page: query.page,
    pageSize: query.pageSize,
    total,
    planningRunId,
  });
};
