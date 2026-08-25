import { once } from "node:events";
import type { Request, Response } from "express";
import { TRAINING_ROWS_HEADER } from "../config/constants.js";
import * as training from "../services/training.service.js";
import { trainingDataQuerySchema } from "../zod/training.schemas.js";

export const streamTrainingData = async (req: Request, res: Response) => {
  const query = trainingDataQuerySchema.parse(req.query);
  const total = await training.countTrainingRows(query);

  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader(TRAINING_ROWS_HEADER, String(total));

  for await (const row of training.streamTrainingRows(query)) {
    if (!res.write(`${JSON.stringify(row)}\n`)) await once(res, "drain");
  }

  res.end();
};
