import type { Request, Response } from "express";
import * as parameters from "../services/parameters.service.js";
import { ok, paginated } from "../utils/response.js";
import { enforceScopeConflict } from "../middleware/scopeDc.js";
import {
  parametersQuerySchema,
  upsertParametersBodySchema,
} from "../zod/parameters.schemas.js";

export const listParameters = async (req: Request, res: Response) => {
  const query = parametersQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouse, req);
  const { items, total } = await parameters.listParameters(query, { warehouseId: req.warehouseScope });
  paginated(res, items, query.page, query.pageSize, total);
};

export const upsertParameters = async (req: Request, res: Response) => {
  const body = upsertParametersBodySchema.parse(req.body ?? {});
  enforceScopeConflict(body.warehouse, req);
  ok(res, await parameters.upsertParameters(body));
};
