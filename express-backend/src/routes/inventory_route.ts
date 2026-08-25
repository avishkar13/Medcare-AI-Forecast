import { Router } from "express";
import * as inventoryController from "../controller/inventorycontroller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";

export const inventoryRouter = Router();

inventoryRouter.get("/", rateLimiter.read, inventoryController.listInventory);
inventoryRouter.get("/:id", rateLimiter.read, inventoryController.getSkuInventory);
