import { Router } from "express";
import * as trainingController from "../controller/trainingcontroller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { requireServiceKey } from "../middleware/serviceKey.js";

export const trainingRouter = Router();

/**
 * Gated on a service key rather than RBAC.
 *
 * The only caller is the forecasting engine, which is a background service with no
 * session to authenticate and no role to authorise. It previously sat behind
 * `authorize("forecast:view")` while sending no credential at all, so training and
 * every forecast failed with a 401 the moment RBAC landed - the engine silently fell
 * back to the naive seasonal forecast.
 */
trainingRouter.get("/", rateLimiter.expensive, requireServiceKey, trainingController.streamTrainingData);
