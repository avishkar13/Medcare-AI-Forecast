import { Router } from "express";
import * as plansController from "../controller/planscontroller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { authorize } from "../middleware/authorize.js";

export const plansRouter = Router();

plansRouter.get("/supply-plans", rateLimiter.read, authorize("simulation:view"), plansController.listSupplyPlans);
plansRouter.get("/drp-plans", rateLimiter.read, authorize("simulation:view"), plansController.listDrpPlans);

// A decision on a proposal. It records intent - nothing here moves stock.
plansRouter.patch("/supply-plans/:id/approve", rateLimiter.write, authorize("simulation:run"), plansController.approveSupplyPlan);
plansRouter.patch("/supply-plans/:id/reject", rateLimiter.write, authorize("simulation:run"), plansController.rejectSupplyPlan);
