import { Router } from "express";
import * as recommendationsController from "../controller/recommendationscontroller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";

export const recommendationsRouter = Router();

recommendationsRouter.get("/", rateLimiter.read, recommendationsController.getList);
recommendationsRouter.get("/kpi", rateLimiter.read, recommendationsController.getKpi);
recommendationsRouter.get("/impact", rateLimiter.read, recommendationsController.getImpact);
recommendationsRouter.get("/summary", rateLimiter.read, recommendationsController.getSummary);
recommendationsRouter.get("/intelligence", rateLimiter.read, recommendationsController.getIntelligence);

// `/list` kept as an alias: it is the path already published in doc/new_docs.
recommendationsRouter.get("/list", rateLimiter.read, recommendationsController.getList);

// State changes, so the write tier.
recommendationsRouter.patch("/:id/execute", rateLimiter.write, recommendationsController.execute);
recommendationsRouter.patch("/:id/dismiss", rateLimiter.write, recommendationsController.dismiss);
