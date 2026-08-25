import { Router } from "express";
import { alertsController } from "../controller/alertscontroller.js";

export const alertsRouter = Router();

alertsRouter.get("/", alertsController.getAlerts);
alertsRouter.get("/overview", alertsController.getOverview);
alertsRouter.get("/trends", alertsController.getTrends);
alertsRouter.get("/distribution", alertsController.getDistribution);
alertsRouter.get("/health", alertsController.getHealth);
alertsRouter.patch("/:id/acknowledge", alertsController.acknowledge);
alertsRouter.patch("/:id/resolve", alertsController.resolve);
alertsRouter.post("/mark-all-read", alertsController.markAllRead);
