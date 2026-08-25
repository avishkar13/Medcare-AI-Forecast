import type { Request, Response } from "express";
import { SERVER } from "../config/constants.js";
import * as planning from "../services/planning.service.js";
import { ok, paginated } from "../utils/response.js";
import {
  createRunBodySchema,
  idempotencyKeySchema,
  runParamsSchema,
  runQuerySchema,
} from "../zod/planning.schemas.js";

const idempotencyKey = (req: Request): string | undefined => {
  const header = req.get("idempotency-key");
  return header === undefined ? undefined : idempotencyKeySchema.parse(header);
};

export const createRun = async (req: Request, res: Response) => {
  const body = createRunBodySchema.parse(req.body ?? {});
  const { run, replayed } = await planning.createRun(body, idempotencyKey(req));

  res.setHeader("Location", `${SERVER.apiPrefix}/planning/runs/${run.id}`);
  ok(res.status(replayed ? 200 : 202), run, { planningRunId: run.id });
};

export const listRuns = async (req: Request, res: Response) => {
  const query = runQuerySchema.parse(req.query);
  const { items, total } = await planning.listRuns(query);
  paginated(res, items, query.page, query.pageSize, total);
};

export const getRun = async (req: Request, res: Response) => {
  const params = runParamsSchema.parse(req.params);
  const run = await planning.getRun(params);
  ok(res, run, { planningRunId: run.id });
};
