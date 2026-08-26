import { Router } from "express";
import * as plansController from "../controller/planscontroller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";

export const plansRouter = Router();

plansRouter.get("/supply-plans", rateLimiter.read, plansController.listSupplyPlans);
plansRouter.get("/drp-plans", rateLimiter.read, plansController.listDrpPlans);

// A decision on a proposal. It records intent - nothing here moves stock.
plansRouter.patch("/supply-plans/:id/approve", rateLimiter.write, plansController.approveSupplyPlan);
plansRouter.patch("/supply-plans/:id/reject", rateLimiter.write, plansController.rejectSupplyPlan);
