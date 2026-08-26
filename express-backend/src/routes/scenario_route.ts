import { Router } from "express";
import * as scenarioController from "../controller/scenariocontroller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { authorize } from "../middleware/authorize.js";

export const scenarioRouter = Router();

// Creating a scenario is a cheap row insert - the `write` tier, not `expensive`.
// Running one is the costly part, and that is already gated on POST /planning/runs.
scenarioRouter.post("/", rateLimiter.write, authorize("simulation:run"), scenarioController.createScenario);
scenarioRouter.get("/", rateLimiter.read, authorize("simulation:view"), scenarioController.listScenarios);
scenarioRouter.get("/:id", rateLimiter.read, authorize("simulation:view"), scenarioController.getScenario);
