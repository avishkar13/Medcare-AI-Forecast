import { Router } from "express";
import * as planningController from "../controller/planningcontroller.js";
import * as movementController from "../controller/movementcontroller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { authorize } from "../middleware/authorize.js";

export const planningRouter = Router();

// The expensive tier, not write: a run schedules ~10,000 rows of work behind the 202.
planningRouter.post("/runs", rateLimiter.expensive, authorize("simulation:run"), planningController.createRun);
planningRouter.get("/runs", rateLimiter.read, authorize("simulation:view"), planningController.listRuns);
// Before /runs/:id is irrelevant to matching - the paths differ in segment count -
// but keeping the pair together reads better than splitting them.
planningRouter.get("/runs/:id", rateLimiter.read, authorize("simulation:view"), planningController.getRun);
planningRouter.get("/runs/:id/compare", rateLimiter.read, authorize("simulation:view"), planningController.compareRuns);
planningRouter.get("/runs/:id/optimization", rateLimiter.read, authorize("simulation:view"), planningController.getOptimization);
planningRouter.get("/runs/:id/simulation", rateLimiter.read, authorize("simulation:view"), planningController.getSimulation);
// The projection curve the executor has always written and nothing read. Phase 3.4.
planningRouter.get("/runs/:id/inventory-plans", rateLimiter.read, authorize("simulation:view"), movementController.getInventoryPlans);
