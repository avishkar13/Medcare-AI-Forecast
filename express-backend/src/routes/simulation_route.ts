import { Router } from "express";
import * as simulationController from "../controller/simulationcontroller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";

export const simulationRouter = Router();

// A what-if schedules a full planning run behind the 202, so it sits on the same
// `expensive` tier as POST /api/planning/runs rather than the cheap write tier.
simulationRouter.post("/run", rateLimiter.expensive, simulationController.run);

simulationRouter.get("/history", rateLimiter.read, simulationController.getHistory);
simulationRouter.get("/saved", rateLimiter.read, simulationController.getSaved);
simulationRouter.post("/save", rateLimiter.write, simulationController.save);
simulationRouter.delete("/saved/:id", rateLimiter.write, simulationController.deleteSaved);
