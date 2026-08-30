import { Router } from "express";
import * as roleController from "../../controller/admin/role.controller.js";
import { rateLimiter } from "../../middleware/rateLimiter.js";
import { authorize } from "../../middleware/authorize.js";

export const roleRoutes = Router();

roleRoutes.use(rateLimiter.read); // apply rate limits
roleRoutes.use(authorize("roles:view")); // general access requirement

roleRoutes.get("/", roleController.listRoles);
roleRoutes.get("/permissions", roleController.listPermissions); // Must be before /:roleId
roleRoutes.get("/:roleId", roleController.getRole);

// Modifying operations
roleRoutes.post("/", authorize("roles:create"), roleController.createRole);
roleRoutes.patch("/:roleId", authorize("roles:update"), roleController.updateRole);
roleRoutes.delete("/:roleId", authorize("roles:delete"), roleController.deleteRole);

roleRoutes.put("/:roleId/permissions", authorize("roles:update"), roleController.assignPermissions);
roleRoutes.delete("/:roleId/permissions/:permissionId", authorize("roles:update"), roleController.removePermission);
