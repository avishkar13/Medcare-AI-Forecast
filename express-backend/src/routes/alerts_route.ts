import { Router } from "express";
import * as alertsController from "../controller/alertscontroller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { authorize } from "../middleware/authorize.js";

export const alertsRouter = Router();

alertsRouter.get("/", rateLimiter.read, authorize("alerts:view"), alertsController.getAlerts);
alertsRouter.get("/overview", rateLimiter.read, authorize("alerts:view"), alertsController.getOverview);
alertsRouter.get("/trends", rateLimiter.read, authorize("alerts:view"), alertsController.getTrends);
alertsRouter.get("/distribution", rateLimiter.read, authorize("alerts:view"), alertsController.getDistribution);
alertsRouter.get("/health", rateLimiter.read, authorize("alerts:view"), alertsController.getHealth);

alertsRouter.patch("/:id/acknowledge", rateLimiter.write, authorize("alerts:manage"), alertsController.acknowledge);
alertsRouter.patch("/:id/resolve", rateLimiter.write, authorize("alerts:manage"), alertsController.resolve);
alertsRouter.post("/mark-all-read", rateLimiter.write, authorize("alerts:manage"), alertsController.markAllRead);
