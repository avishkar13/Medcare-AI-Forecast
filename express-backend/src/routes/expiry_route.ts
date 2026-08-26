import { Router } from "express";
import * as expiryController from "../controller/expirycontroller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { authorize } from "../middleware/authorize.js";

export const expiryRouter = Router();

expiryRouter.get("/batches", rateLimiter.read, authorize("expiry:view"), expiryController.getBatches);
expiryRouter.get("/overview", rateLimiter.read, authorize("expiry:view"), expiryController.getOverview);
expiryRouter.get("/timeline", rateLimiter.read, authorize("expiry:view"), expiryController.getTimeline);
expiryRouter.get("/exposure", rateLimiter.read, authorize("expiry:view"), expiryController.getExposure);
expiryRouter.get("/demand-coverage", rateLimiter.read, authorize("expiry:view"), expiryController.getDemandCoverage);
expiryRouter.get("/dc-exposure", rateLimiter.read, authorize("expiry:view"), expiryController.getDcExposure);
expiryRouter.get("/ai-assessment", rateLimiter.read, authorize("expiry:view"), expiryController.getAssessment);
expiryRouter.get("/waste-prevention", rateLimiter.read, authorize("expiry:view"), expiryController.getWastePrevention);

// POST /batches/:id/prioritize is deliberately not re-implemented. It returned
// { success: true } while doing nothing: there is no field on InventoryBatch to
// prioritise and no queue to add to, so it reported an action that never happened.
// Batch prioritisation belongs to the recommendation lifecycle.
