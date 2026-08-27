import { Router } from "express";
import * as movementController from "../controller/movementcontroller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { authorize } from "../middleware/authorize.js";

/**
 * The DC surface - what a distribution centre reports, and what it asks for.
 *
 * `POST /movements` is the only write in the product that actually changes stock.
 * It sits on the `write` tier rather than `expensive`: a DC terminal records many
 * movements a day, and 10/hour would stop a real shift dead. It is idempotent via
 * `Idempotency-Key`, which is what makes a retry safe rather than a duplicate sale.
 */
export const dcRouter = Router();

dcRouter.post(
  "/:code/movements",
  rateLimiter.write,
  authorize("inventory:adjust"),
  movementController.recordMovement,
);

dcRouter.get(
  "/:code/sync",
  rateLimiter.read,
  authorize("inventory:view"),
  movementController.getDcSync,
);
