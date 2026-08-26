import { Router } from "express";
import * as simulationController from "../controller/simulationcontroller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { authorize } from "../middleware/authorize.js";

export const simulationRouter = Router();

// A what-if schedules a full planning run behind the 202, so it sits on the same
// `expensive` tier as POST /api/planning/runs rather than the cheap write tier.
simulationRouter.post("/run", rateLimiter.expensive, authorize("simulation:run"), simulationController.run);

simulationRouter.get("/history", rateLimiter.read, authorize("simulation:view"), simulationController.getHistory);
simulationRouter.get("/saved", rateLimiter.read, authorize("simulation:view"), simulationController.getSaved);
simulationRouter.post("/save", rateLimiter.write, authorize("simulation:run"), simulationController.save);
simulationRouter.delete("/saved/:id", rateLimiter.write, authorize("simulation:run"), simulationController.deleteSaved);
