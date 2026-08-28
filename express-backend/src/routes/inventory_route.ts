import { Router } from "express";
import * as inventoryController from "../controller/inventorycontroller.js";
import * as movementController from "../controller/movementcontroller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { authorize } from "../middleware/authorize.js";
import * as exportController from "../controller/exportcontroller.js";

export const inventoryRouter = Router();

inventoryRouter.get("/", rateLimiter.read, authorize("inventory:view"), inventoryController.listInventory);

// Above any `/:id` route: Express matches in order, and a parameter segment would
// otherwise swallow `/export` and answer it as a lookup for an item called "export".
inventoryRouter.get("/export", rateLimiter.read, authorize("inventory:view"), exportController.exportInventory);

// Before `/:id`, or the parameter swallows it and the ledger reads as a SKU lookup.
inventoryRouter.get("/movements", rateLimiter.read, authorize("inventory:view"), movementController.listMovements);

inventoryRouter.get("/:id", rateLimiter.read, authorize("inventory:view"), inventoryController.getSkuInventory);
