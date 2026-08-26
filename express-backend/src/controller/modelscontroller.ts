import type { Request, Response } from "express";
import { fetchModelMetrics, requestTraining } from "../lib/forecast-client.js";
import { ok } from "../utils/response.js";
import { trainBodySchema } from "../zod/models.schemas.js";

export const train = async (req: Request, res: Response) => {
  const body = trainBodySchema.parse(req.body ?? {});
  ok(res, await requestTraining(body.modelVersion));
};

export const metrics = async (_req: Request, res: Response) => {
  ok(res, await fetchModelMetrics());
};
