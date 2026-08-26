import { Router } from "express";
import * as userController from "../../controller/admin/user.controller.js";
import { rateLimiter } from "../../middleware/rateLimiter.js";
import { authorize } from "../../middleware/authorize.js";

export const userRoutes = Router();

userRoutes.use(rateLimiter.read); // apply rate limits
userRoutes.use(authorize("users:view")); // general access requirement

userRoutes.get("/", userController.listUsers);

// Modifying operations
userRoutes.post("/", authorize("users:create"), userController.createUser);
userRoutes.patch("/:userId", authorize("users:edit"), userController.updateUser);
userRoutes.patch("/:userId/status", authorize("users:deactivate"), userController.deactivateUser);
userRoutes.post("/:userId/reset-password", authorize("users:edit"), userController.resetPassword);
