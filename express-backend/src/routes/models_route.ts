import { Router } from "express";
import * as modelsController from "../controller/modelscontroller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";

export const modelsRouter = Router();

// Fitting is minutes of CPU on the engine and rewrites its model artefact, so it
// sits on the `expensive` tier beside the planning run that consumes the result.
modelsRouter.post("/train", rateLimiter.expensive, modelsController.train);
modelsRouter.get("/metrics", rateLimiter.read, modelsController.metrics);

// The engine's own routes stay internal: the frontend calls Express, Express calls
// Python, never the other way round. Python reaching back is limited to pulling
// GET /api/training-data, which is the one documented direction.
