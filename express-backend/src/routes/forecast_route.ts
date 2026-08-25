import { Router } from "express";
import { forecastController } from "../controller/forecastcontroller.js";

export const forecastRouter = Router();

forecastRouter.get("/kpi", forecastController.getKpi);
forecastRouter.get("/summary", forecastController.getSummary);
forecastRouter.get("/main-chart", forecastController.getMainChart);
forecastRouter.get("/trend", forecastController.getTrend);
forecastRouter.get("/seasonality", forecastController.getSeasonality);
forecastRouter.get("/network", forecastController.getNetwork);
forecastRouter.get("/insight", forecastController.getInsight);
forecastRouter.get("/performance", forecastController.getPerformance);
forecastRouter.get("/impact", forecastController.getImpact);
forecastRouter.get("/skus", forecastController.getSkus);
