import { Router } from "express";
import * as movementController from "../controller/movementcontroller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { authorize } from "../middleware/authorize.js";

/**
 * Restock requests - a human asking for stock.
 *
 * Deciding one records intent and moves nothing; the arriving stock is a movement,
 * which is the only thing that changes `Inventory`. `inventory:adjust` gates both the
 * request and the decision: whoever can move stock at a DC can ask for more of it.
 */
export const restockRouter = Router();

restockRouter.get("/", rateLimiter.read, authorize("inventory:view"), movementController.listRestockRequests);
restockRouter.post("/", rateLimiter.write, authorize("inventory:adjust"), movementController.createRestockRequest);

restockRouter.patch("/:id/approve", rateLimiter.write, authorize("inventory:adjust"), movementController.approveRestockRequest);
restockRouter.patch("/:id/reject", rateLimiter.write, authorize("inventory:adjust"), movementController.rejectRestockRequest);
