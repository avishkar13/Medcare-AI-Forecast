import { Router } from "express";
import * as recommendationsController from "../controller/recommendationscontroller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { authorize } from "../middleware/authorize.js";

export const recommendationsRouter = Router();

recommendationsRouter.get("/", rateLimiter.read, authorize("recommendations:view"), recommendationsController.getList);
recommendationsRouter.get("/kpi", rateLimiter.read, authorize("recommendations:view"), recommendationsController.getKpi);
recommendationsRouter.get("/impact", rateLimiter.read, authorize("recommendations:view"), recommendationsController.getImpact);
recommendationsRouter.get("/summary", rateLimiter.read, authorize("recommendations:view"), recommendationsController.getSummary);
recommendationsRouter.get("/intelligence", rateLimiter.read, authorize("recommendations:view"), recommendationsController.getIntelligence);

// `/list` kept as an alias: it is the path already published in doc/new_docs.
recommendationsRouter.get("/list", rateLimiter.read, authorize("recommendations:view"), recommendationsController.getList);

// State changes, so the write tier.
recommendationsRouter.patch("/:id/execute", rateLimiter.write, authorize("recommendations:execute"), recommendationsController.execute);
recommendationsRouter.patch("/:id/dismiss", rateLimiter.write, authorize("recommendations:dismiss"), recommendationsController.dismiss);
