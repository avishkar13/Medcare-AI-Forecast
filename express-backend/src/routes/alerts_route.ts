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

// The write tier, not the expensive one. A cycle is seconds and reconciles rows that
// already exist - it is nothing like a planning run, which schedules ~10,000 rows
// behind a 202. On `expensive` (10/hour) the Refresh button returned 429 on the
// eleventh press, which is easy to reach while working through a review queue.
alertsRouter.post("/refresh", rateLimiter.write, authorize("alerts:manage"), alertsController.refresh);

// This one stays expensive: it reaches a third-party provider on every call.
alertsRouter.post("/test-notification", rateLimiter.expensive, authorize("alerts:manage"), alertsController.testNotification);

alertsRouter.patch("/:id/acknowledge", rateLimiter.write, authorize("alerts:manage"), alertsController.acknowledge);
alertsRouter.patch("/:id/resolve", rateLimiter.write, authorize("alerts:manage"), alertsController.resolve);
alertsRouter.post("/mark-all-read", rateLimiter.write, authorize("alerts:manage"), alertsController.markAllRead);
