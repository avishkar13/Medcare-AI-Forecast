import { Router } from "express";
import * as forecastController from "../controller/forecastcontroller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";

export const forecastRouter = Router();

// Every route reads a completed planning run's artefacts: the `read` tier.
forecastRouter.get("/kpi", rateLimiter.read, forecastController.getKpi);
forecastRouter.get("/summary", rateLimiter.read, forecastController.getSummary);
forecastRouter.get("/main-chart", rateLimiter.read, forecastController.getMainChart);
forecastRouter.get("/trend", rateLimiter.read, forecastController.getTrend);
forecastRouter.get("/seasonality", rateLimiter.read, forecastController.getSeasonality);
forecastRouter.get("/network", rateLimiter.read, forecastController.getNetwork);
forecastRouter.get("/insight", rateLimiter.read, forecastController.getInsight);
forecastRouter.get("/performance", rateLimiter.read, forecastController.getPerformance);
forecastRouter.get("/impact", rateLimiter.read, forecastController.getImpact);
forecastRouter.get("/skus", rateLimiter.read, forecastController.getSkus);
