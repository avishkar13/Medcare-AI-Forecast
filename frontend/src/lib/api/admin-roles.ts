import { api } from "./client";

export interface Permission {
  id: string;
  key: string;
  name: string;
  module: string;
  action: string;
  description: string | null;
  createdAt: string;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystemRole: boolean;
  createdAt: string;
  updatedAt: string;
  userCount?: number;
  permissions?: Permission[];
}

export interface CreateRoleInput {
  name: string;
  description?: string;
}

export interface UpdateRoleInput {
  name?: string;
  description?: string;
}

export interface AssignPermissionsInput {
  permissionIds: string[];
}

export const listRoles = async () => {
  return await api.get<Role[]>("/admin/roles");
};

export const getRole = async (roleId: string) => {
  return await api.get<Role>(`/admin/roles/${roleId}`);
};

export const createRole = async (data: CreateRoleInput) => {
  return await api.post<Role>("/admin/roles", data);
};

export const updateRole = async (roleId: string, data: UpdateRoleInput) => {
  return await api.patch<Role>(`/admin/roles/${roleId}`, data);
};

export const deleteRole = async (roleId: string) => {
  return await api.delete<void>(`/admin/roles/${roleId}`);
};

export const listPermissions = async () => {
  return await api.get<Permission[]>("/admin/roles/permissions");
};

export const assignRolePermissions = async (roleId: string, data: AssignPermissionsInput) => {
  return await api.put<Role>(`/admin/roles/${roleId}/permissions`, data);
};
