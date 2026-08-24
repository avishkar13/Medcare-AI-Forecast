import { Router } from "express";
import * as dashboardController from "../controller/dashboardcontroller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";

export const dashboardRouter = Router();

dashboardRouter.get("/summary", rateLimiter.read, dashboardController.summary);
dashboardRouter.get("/network", rateLimiter.read, dashboardController.network);
dashboardRouter.get("/inventory-health", rateLimiter.read, dashboardController.inventoryHealth);
dashboardRouter.get("/expiry-risk", rateLimiter.read, dashboardController.expiryRisk);
dashboardRouter.get("/priority-actions", rateLimiter.read, dashboardController.priorityActions);
