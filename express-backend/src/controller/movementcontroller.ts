import type { Request, Response } from "express";
import * as movements from "../services/movement.service.js";
import * as restock from "../services/restock.service.js";
import { ok, paginated } from "../utils/response.js";
import { enforceScopeConflict } from "../middleware/scopeDc.js";
import { idempotencyKeySchema } from "../zod/planning.schemas.js";
import {
  dcParamsSchema,
  inventoryPlanQuerySchema,
  movementQuerySchema,
  recordMovementBodySchema,
  restockParamsSchema,
  restockQuerySchema,
  restockRequestBodySchema,
  runParamsSchema,
} from "../zod/movement.schemas.js";

const idempotencyKey = (req: Request): string | undefined => {
  const header = req.get("idempotency-key");
  return header === undefined ? undefined : idempotencyKeySchema.parse(header);
};

export const recordMovement = async (req: Request, res: Response) => {
  const params = dcParamsSchema.parse(req.params);
  const body = recordMovementBodySchema.parse(req.body ?? {});
  // The DC is in the path, so it is the thing a confined caller must not cross.
  enforceScopeConflict(params.code, req);

  const result = await movements.recordMovement(
    params.code,
    body,
    idempotencyKey(req),
    req.userId,
  );

  const { replayed, ...payload } = result;
  ok(res.status(replayed ? 200 : 201), payload);
};

export const listMovements = async (req: Request, res: Response) => {
  const query = movementQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouse ?? query.dc, req);
  const { items, total } = await movements.listMovements(query, {
    warehouseId: req.warehouseScope,
  });
  paginated(res, items, query.page, query.pageSize, total);
};

export const getDcSync = async (req: Request, res: Response) => {
  const params = dcParamsSchema.parse(req.params);
  enforceScopeConflict(params.code, req);
  ok(res, await movements.getDcSync(params.code));
};

export const getInventoryPlans = async (req: Request, res: Response) => {
  const params = runParamsSchema.parse(req.params);
  const query = inventoryPlanQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouse, req);
  const report = await movements.getInventoryPlans(params.id, query, {
    warehouseId: req.warehouseScope,
  });
  ok(res, report, { planningRunId: report.planningRunId });
};

export const createRestockRequest = async (req: Request, res: Response) => {
  const body = restockRequestBodySchema.parse(req.body ?? {});
  enforceScopeConflict(body.warehouse, req);
  ok(
    res.status(201),
    await restock.createRestockRequest(body, req.userId, { warehouseId: req.warehouseScope }),
  );
};

export const listRestockRequests = async (req: Request, res: Response) => {
  const query = restockQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouse, req);
  const { items, total } = await restock.listRestockRequests(query, {
    warehouseId: req.warehouseScope,
  });
  paginated(res, items, query.page, query.pageSize, total);
};

export const approveRestockRequest = async (req: Request, res: Response) => {
  const params = restockParamsSchema.parse(req.params);
  ok(
    res,
    await restock.decideRestockRequest(params.id, "approve", req.userId, {
      warehouseId: req.warehouseScope,
    }),
  );
};

export const rejectRestockRequest = async (req: Request, res: Response) => {
  const params = restockParamsSchema.parse(req.params);
  ok(
    res,
    await restock.decideRestockRequest(params.id, "reject", req.userId, {
      warehouseId: req.warehouseScope,
    }),
  );
};
