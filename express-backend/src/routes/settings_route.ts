import { Router } from "express";
import * as settingsController from "../controller/settingscontroller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";

export const settingsRouter = Router();

settingsRouter.get("/", rateLimiter.read, settingsController.getSettings);
settingsRouter.patch("/", rateLimiter.write, settingsController.updateSettings);
settingsRouter.put("/", rateLimiter.write, settingsController.replaceSettings);

// POST /integrations/test and POST /security/reset-password are deliberately not
// re-implemented. They returned "Connection successful, latencyMs: 145" and
// "Password reset email sent" without contacting anything or sending anything.
//
// The first needs a configured ERP endpoint to reach; the second needs both an
// authenticated user (WP-16) and mail delivery. A password-reset route that reports
// success while sending nothing is worse than a missing one: the user waits for an
// email that was never going to arrive.
