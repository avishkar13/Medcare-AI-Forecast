import type { Request, Response } from "express";
import { SERVER } from "../config/constants.js";
import * as simulation from "../services/simulation.service.js";
import { ok } from "../utils/response.js";
import {
  saveScenarioBodySchema,
  scenarioIdParamsSchema,
  simulationListQuerySchema,
  whatIfBodySchema,
} from "../zod/simulation.schemas.js";

export const run = async (req: Request, res: Response) => {
  const body = whatIfBodySchema.parse(req.body ?? {});
  const result = await simulation.runWhatIf(body, req.userId, { warehouseId: req.warehouseScope });

  // 202: the run was accepted, not finished. Poll `pollAt`.
  res.setHeader("Location", `${SERVER.apiPrefix}/planning/runs/${result.run.id}`);
  ok(res.status(202), result, { planningRunId: result.run.id });
};

export const getHistory = async (req: Request, res: Response) => {
  const { limit } = simulationListQuerySchema.parse(req.query);
  ok(res, await simulation.listHistory(limit));
};

export const getSaved = async (req: Request, res: Response) => {
  const { limit } = simulationListQuerySchema.parse(req.query);
  ok(res, await simulation.listSaved(limit));
};

export const save = async (req: Request, res: Response) => {
  const body = saveScenarioBodySchema.parse(req.body ?? {});
  ok(res.status(201), await simulation.saveScenario(body, req.userId, { warehouseId: req.warehouseScope }));
};

export const deleteSaved = async (req: Request, res: Response) => {
  const { id } = scenarioIdParamsSchema.parse(req.params);
  await simulation.deleteScenario(id);
  res.status(204).end();
};
