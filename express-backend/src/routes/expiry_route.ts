import { Router } from "express";
import { expiryController } from "../controller/expirycontroller.js";

export const expiryRouter = Router();

expiryRouter.get("/batches", expiryController.getBatches);
expiryRouter.get("/overview", expiryController.getOverview);
expiryRouter.get("/timeline", expiryController.getTimeline);
expiryRouter.get("/dc-exposure", expiryController.getDcExposure);
expiryRouter.get("/ai-assessment", expiryController.getAiAssessment);
expiryRouter.get("/waste-prevention", expiryController.getWastePrevention);
expiryRouter.post("/batches/:id/prioritize", expiryController.prioritizeBatch);
