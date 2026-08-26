import { Router } from "express";
import * as inventoryController from "../controller/inventorycontroller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { authorize } from "../middleware/authorize.js";

export const inventoryRouter = Router();

inventoryRouter.get("/", rateLimiter.read, authorize("inventory:view"), inventoryController.listInventory);
inventoryRouter.get("/:id", rateLimiter.read, authorize("inventory:view"), inventoryController.getSkuInventory);
