import type { Request, Response } from "express";
import { SERVER } from "../config/constants.js";
import * as scenarios from "../services/scenario.service.js";
import { ok, paginated } from "../utils/response.js";
import {
  createScenarioBodySchema,
  scenarioParamsSchema,
  scenarioQuerySchema,
} from "../zod/scenario.schemas.js";

export const createScenario = async (req: Request, res: Response) => {
  const body = createScenarioBodySchema.parse(req.body ?? {});
  const scenario = await scenarios.createScenario(body, req.userId);

  res.setHeader("Location", `${SERVER.apiPrefix}/scenarios/${scenario.id}`);
  ok(res.status(201), scenario);
};

export const listScenarios = async (req: Request, res: Response) => {
  const query = scenarioQuerySchema.parse(req.query);
  const { items, total } = await scenarios.listScenarios(query);
  paginated(res, items, query.page, query.pageSize, total);
};

export const getScenario = async (req: Request, res: Response) => {
  const params = scenarioParamsSchema.parse(req.params);
  ok(res, await scenarios.getScenario(params));
};
