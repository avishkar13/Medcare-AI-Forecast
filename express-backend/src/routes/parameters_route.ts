import { Router } from "express";
import * as parametersController from "../controller/parameterscontroller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";

export const parametersRouter = Router();

parametersRouter.get("/", rateLimiter.read, parametersController.listParameters);

// PUT, not PATCH: the planning values are read as a set when safety stock is
// computed, so they are written as a set. Upserts on @@unique([productId, warehouseId]).
parametersRouter.put("/", rateLimiter.write, parametersController.upsertParameters);
