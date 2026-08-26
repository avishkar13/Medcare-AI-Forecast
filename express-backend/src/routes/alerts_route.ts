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

alertsRouter.get("/notifications", rateLimiter.read, authorize("alerts:view"), alertsController.getDeliveries);

// Detection reconciles the whole table, so it sits on the expensive tier beside a
// planning run rather than the write tier used for single-row transitions.
alertsRouter.post("/refresh", rateLimiter.expensive, authorize("alerts:manage"), alertsController.refresh);
alertsRouter.post("/test-notification", rateLimiter.expensive, authorize("alerts:manage"), alertsController.testNotification);

alertsRouter.patch("/:id/acknowledge", rateLimiter.write, authorize("alerts:manage"), alertsController.acknowledge);
alertsRouter.patch("/:id/resolve", rateLimiter.write, authorize("alerts:manage"), alertsController.resolve);
alertsRouter.post("/mark-all-read", rateLimiter.write, authorize("alerts:manage"), alertsController.markAllRead);
