import { Router } from "express";
import * as inventoryController from "../controller/inventorycontroller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";

export const inventoryRouter = Router();

inventoryRouter.get("/kpi", inventoryController.getKpi);
inventoryRouter.get("/health", inventoryController.getHealth);
inventoryRouter.get("/network", inventoryController.getNetwork);
inventoryRouter.get("/items", rateLimiter.read, inventoryController.listInventory);
inventoryRouter.get("/items/:id", rateLimiter.read, inventoryController.getSkuInventory);
// Maintain legacy root paths if needed elsewhere
inventoryRouter.get("/", rateLimiter.read, inventoryController.listInventory);
inventoryRouter.get("/:id", rateLimiter.read, inventoryController.getSkuInventory);
