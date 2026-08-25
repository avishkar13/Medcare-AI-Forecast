import { Router } from "express";
import { recommendationsController } from "../controller/recommendationscontroller.js";

export const recommendationsRouter = Router();

recommendationsRouter.get("/kpi", recommendationsController.getKpi);
recommendationsRouter.get("/impact", recommendationsController.getImpact);
recommendationsRouter.get("/summary", recommendationsController.getSummary);
recommendationsRouter.get("/list", recommendationsController.getList);
recommendationsRouter.get("/intelligence", recommendationsController.getIntelligence);
recommendationsRouter.patch("/:id/execute", recommendationsController.execute);
recommendationsRouter.patch("/:id/dismiss", recommendationsController.dismiss);
