import type { Request, Response } from "express";
import * as parameters from "../services/parameters.service.js";
import { ok, paginated } from "../utils/response.js";
import {
  parametersQuerySchema,
  upsertParametersBodySchema,
} from "../zod/parameters.schemas.js";

export const listParameters = async (req: Request, res: Response) => {
  const query = parametersQuerySchema.parse(req.query);
  const { items, total } = await parameters.listParameters(query);
  paginated(res, items, query.page, query.pageSize, total);
};

export const upsertParameters = async (req: Request, res: Response) => {
  const body = upsertParametersBodySchema.parse(req.body ?? {});
  ok(res, await parameters.upsertParameters(body));
};
