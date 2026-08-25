import { Router } from "express";
import * as planningController from "../controller/planningcontroller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";

export const planningRouter = Router();

// The expensive tier, not write: a run schedules ~10,000 rows of work behind the 202.
planningRouter.post("/runs", rateLimiter.expensive, planningController.createRun);
planningRouter.get("/runs", rateLimiter.read, planningController.listRuns);
// Before /runs/:id is irrelevant to matching - the paths differ in segment count -
// but keeping the pair together reads better than splitting them.
planningRouter.get("/runs/:id", rateLimiter.read, planningController.getRun);
planningRouter.get("/runs/:id/compare", rateLimiter.read, planningController.compareRuns);
