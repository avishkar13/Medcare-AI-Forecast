import { Router } from "express";
import * as forecastController from "../controller/forecastcontroller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { authorize } from "../middleware/authorize.js";

export const forecastRouter = Router();

// Every route reads a completed planning run's artefacts: the `read` tier.
forecastRouter.get("/kpi", rateLimiter.read, authorize("forecast:view"), forecastController.getKpi);
forecastRouter.get("/summary", rateLimiter.read, authorize("forecast:view"), forecastController.getSummary);
forecastRouter.get("/main-chart", rateLimiter.read, authorize("forecast:view"), forecastController.getMainChart);
forecastRouter.get("/trend", rateLimiter.read, authorize("forecast:view"), forecastController.getTrend);
forecastRouter.get("/seasonality", rateLimiter.read, authorize("forecast:view"), forecastController.getSeasonality);
forecastRouter.get("/network", rateLimiter.read, authorize("forecast:view"), forecastController.getNetwork);
forecastRouter.get("/insight", rateLimiter.read, authorize("forecast:view"), forecastController.getInsight);
forecastRouter.get("/performance", rateLimiter.read, authorize("forecast:view"), forecastController.getPerformance);
// WP-19: scored against realised demand, the read behind DashboardKPIs.forecastAccuracy.
forecastRouter.get("/accuracy", rateLimiter.read, authorize("forecast:view"), forecastController.getAccuracy);
forecastRouter.get("/impact", rateLimiter.read, authorize("forecast:view"), forecastController.getImpact);
forecastRouter.get("/skus", rateLimiter.read, authorize("forecast:view"), forecastController.getSkus);
