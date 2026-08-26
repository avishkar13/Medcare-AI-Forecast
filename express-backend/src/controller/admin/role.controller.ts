import type { Request, Response } from "express";
import * as roleService from "../../services/admin/role.service.js";
import { ok } from "../../utils/response.js";
import {
  createRoleSchema,
  updateRoleSchema,
  assignPermissionsSchema,
  roleParamsSchema,
  permissionParamsSchema,
} from "../../zod/admin/role.schema.js";

export const listRoles = async (_req: Request, res: Response) => {
  ok(res, await roleService.listRoles());
};

export const getRole = async (req: Request, res: Response) => {
  const { roleId } = roleParamsSchema.parse(req.params);
  ok(res, await roleService.getRole(roleId));
};

export const createRole = async (req: Request, res: Response) => {
  const body = createRoleSchema.parse(req.body);
  res.status(201).json({ data: await roleService.createRole(body) });
};

export const updateRole = async (req: Request, res: Response) => {
  const { roleId } = roleParamsSchema.parse(req.params);
  const body = updateRoleSchema.parse(req.body);
  ok(res, await roleService.updateRole(roleId, body));
};

export const deleteRole = async (req: Request, res: Response) => {
  const { roleId } = roleParamsSchema.parse(req.params);
  ok(res, await roleService.deleteRole(roleId));
};

export const listPermissions = async (_req: Request, res: Response) => {
  ok(res, await roleService.listPermissions());
};

export const assignPermissions = async (req: Request, res: Response) => {
  const { roleId } = roleParamsSchema.parse(req.params);
  const { permissionIds } = assignPermissionsSchema.parse(req.body);
  ok(res, await roleService.assignPermissions(roleId, permissionIds));
};

export const removePermission = async (req: Request, res: Response) => {
  const { roleId, permissionId } = permissionParamsSchema.parse(req.params);
  ok(res, await roleService.removePermission(roleId, permissionId));
};
