import { Router } from "express";
import * as inventoryController from "../controller/inventorycontroller.js";
import * as movementController from "../controller/movementcontroller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { authorize } from "../middleware/authorize.js";

export const inventoryRouter = Router();

inventoryRouter.get("/", rateLimiter.read, authorize("inventory:view"), inventoryController.listInventory);

// Before `/:id`, or the parameter swallows it and the ledger reads as a SKU lookup.
inventoryRouter.get("/movements", rateLimiter.read, authorize("inventory:view"), movementController.listMovements);

inventoryRouter.get("/:id", rateLimiter.read, authorize("inventory:view"), inventoryController.getSkuInventory);
