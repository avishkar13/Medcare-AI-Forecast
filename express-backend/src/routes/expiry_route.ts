import { Router } from "express";
import * as expiryController from "../controller/expirycontroller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";

export const expiryRouter = Router();

expiryRouter.get("/batches", rateLimiter.read, expiryController.getBatches);
expiryRouter.get("/overview", rateLimiter.read, expiryController.getOverview);
expiryRouter.get("/timeline", rateLimiter.read, expiryController.getTimeline);
expiryRouter.get("/dc-exposure", rateLimiter.read, expiryController.getDcExposure);
expiryRouter.get("/ai-assessment", rateLimiter.read, expiryController.getAssessment);
expiryRouter.get("/waste-prevention", rateLimiter.read, expiryController.getWastePrevention);

// POST /batches/:id/prioritize is deliberately not re-implemented. It returned
// { success: true } while doing nothing: there is no field on InventoryBatch to
// prioritise and no queue to add to, so it reported an action that never happened.
// Batch prioritisation belongs to the recommendation lifecycle.
