import { z } from "zod";

const text = z.string().trim().min(1);

export const createRoleSchema = z.object({
  name: text,
  description: z.string().trim().optional(),
});

export const updateRoleSchema = z.object({
  name: text.optional(),
  description: z.string().trim().optional(),
});

export const assignPermissionsSchema = z.object({
  permissionIds: z.array(text),
});

export const roleParamsSchema = z.object({
  roleId: text,
});

export const permissionParamsSchema = z.object({
  roleId: text,
  permissionId: text,
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type AssignPermissionsInput = z.infer<typeof assignPermissionsSchema>;
export type RoleParams = z.infer<typeof roleParamsSchema>;
export type PermissionParams = z.infer<typeof permissionParamsSchema>;
