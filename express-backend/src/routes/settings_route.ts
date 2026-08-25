import { Router } from "express";
import { settingsController } from "../controller/settingscontroller.js";

export const settingsRouter = Router();

settingsRouter.get("/", settingsController.getSettings);
settingsRouter.patch("/", settingsController.updateSettings);
settingsRouter.put("/", settingsController.updateSettings);
settingsRouter.post("/integrations/test", settingsController.testIntegration);
settingsRouter.post("/security/reset-password", settingsController.resetPassword);
