import { Router } from "express";
import * as trainingController from "../controller/trainingcontroller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";

export const trainingRouter = Router();

trainingRouter.get("/", rateLimiter.expensive, trainingController.streamTrainingData);
