import { Router } from "express";
import { rateLimiter } from "../middleware/rateLimiter.js";
import * as healthController from "../controller/healthcontroller.js";

export const healthRouter = Router();

healthRouter.get("/live", healthController.live);
healthRouter.get("/ready", rateLimiter.read, healthController.ready);
