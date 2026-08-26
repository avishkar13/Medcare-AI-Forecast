import { Router } from "express";
import * as trainingController from "../controller/trainingcontroller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { authorize } from "../middleware/authorize.js";

export const trainingRouter = Router();

trainingRouter.get("/", rateLimiter.expensive, authorize("forecast:view"), trainingController.streamTrainingData);
