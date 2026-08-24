import { Router } from "express";
import * as dashboardController from "../controller/dashboardcontroller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";

export const dashboardRouter = Router();

dashboardRouter.get("/summary", rateLimiter.read, dashboardController.summary);
