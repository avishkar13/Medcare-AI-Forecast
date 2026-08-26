import { Router } from "express";
import * as dashboardController from "../controller/dashboardcontroller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { authorize } from "../middleware/authorize.js";

export const dashboardRouter = Router();

dashboardRouter.get("/summary", rateLimiter.read, authorize("dashboard:view"), dashboardController.summary);
dashboardRouter.get("/network", rateLimiter.read, authorize("dashboard:view"), dashboardController.network);
dashboardRouter.get("/inventory-health", rateLimiter.read, authorize("dashboard:view"), dashboardController.inventoryHealth);
dashboardRouter.get("/expiry-risk", rateLimiter.read, authorize("dashboard:view"), dashboardController.expiryRisk);
dashboardRouter.get("/priority-actions", rateLimiter.read, authorize("dashboard:view"), dashboardController.priorityActions);
