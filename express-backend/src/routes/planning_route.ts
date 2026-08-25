import { Router } from "express";
import * as planningController from "../controller/planningcontroller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";

export const planningRouter = Router();

planningRouter.post("/runs", rateLimiter.write, planningController.createRun);
planningRouter.get("/runs", rateLimiter.read, planningController.listRuns);
planningRouter.get("/runs/:id", rateLimiter.read, planningController.getRun);
