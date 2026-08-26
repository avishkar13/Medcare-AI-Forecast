import { Router } from "express";
import * as parametersController from "../controller/parameterscontroller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { authorize } from "../middleware/authorize.js";

export const parametersRouter = Router();

parametersRouter.get("/", rateLimiter.read, authorize("simulation:view"), parametersController.listParameters);

// PUT, not PATCH: the planning values are read as a set when safety stock is
// computed, so they are written as a set. Upserts on @@unique([productId, warehouseId]).
parametersRouter.put("/", rateLimiter.write, authorize("simulation:run"), parametersController.upsertParameters);
