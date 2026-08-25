import { once } from "node:events";
import type { Request, Response } from "express";
import { TRAINING_ROWS_HEADER } from "../config/constants.js";
import * as training from "../services/training.service.js";
import { trainingDataQuerySchema } from "../zod/training.schemas.js";

const FUTURE_PROMOTIONS_HEADER = "x-future-promotions";
const FUTURE_SIGNALS_HEADER = "x-future-signals";

export const streamTrainingData = async (req: Request, res: Response) => {
  const query = trainingDataQuerySchema.parse(req.query);
  const [total, futurePromoCount, futureSignalCount] = await Promise.all([
    training.countTrainingRows(query),
    training.countFuturePromotions(),
    training.countFutureSignals(),
  ]);

  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader(TRAINING_ROWS_HEADER, String(total));
  res.setHeader(FUTURE_PROMOTIONS_HEADER, String(futurePromoCount));
  res.setHeader(FUTURE_SIGNALS_HEADER, String(futureSignalCount));

  // Stream demand-history rows (enriched with promotion + signal data)
  for await (const row of training.streamTrainingRows(query)) {
    if (!res.write(`${JSON.stringify(row)}\n`)) await once(res, "drain");
  }

  // Trailer segments, each tagged with `_type` and each with its own count header,
  // so a reader verifies every segment separately instead of against one total.
  for await (const row of training.streamFutureSignals()) {
    if (!res.write(`${JSON.stringify(row)}
`)) await once(res, "drain");
  }

  for await (const row of training.streamFuturePromotions()) {
    if (!res.write(`${JSON.stringify(row)}\n`)) await once(res, "drain");
  }

  res.end();
};

