import { Router } from "express";
import * as alertsController from "../controller/alertscontroller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";

export const alertsRouter = Router();

alertsRouter.get("/", rateLimiter.read, alertsController.getAlerts);
alertsRouter.get("/overview", rateLimiter.read, alertsController.getOverview);
alertsRouter.get("/trends", rateLimiter.read, alertsController.getTrends);
alertsRouter.get("/distribution", rateLimiter.read, alertsController.getDistribution);
alertsRouter.get("/health", rateLimiter.read, alertsController.getHealth);

alertsRouter.patch("/:id/acknowledge", rateLimiter.write, alertsController.acknowledge);
alertsRouter.patch("/:id/resolve", rateLimiter.write, alertsController.resolve);
alertsRouter.post("/mark-all-read", rateLimiter.write, alertsController.markAllRead);
