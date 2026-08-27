import { api } from "./client";
import type { QueryParams } from "./types";

export interface User {
  id: string;
  name: string;
  email: string;
  roleId: string;
  warehouseId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  role: {
    id: string;
    name: string;
  };
}

export interface UserQueryParams extends QueryParams {
  roleId?: string;
  warehouseId?: string;
  active?: boolean;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password?: string;
  roleId: string;
  warehouseId?: string | null;
}

export interface UpdateUserInput {
  name?: string;
  roleId?: string;
  warehouseId?: string | null;
  active?: boolean;
}

export interface UpdateStatusInput {
  active: boolean;
}

export interface ResetPasswordInput {
  password?: string;
}

export const listUsers = async (params?: UserQueryParams) => {
  return await api.get<User[]>("/admin/users", params);
};

export const createUser = async (data: CreateUserInput) => {
  return await api.post<User>("/admin/users", data);
};

export const updateUser = async (userId: string, data: UpdateUserInput) => {
  return await api.patch<User>(`/admin/users/${userId}`, data);
};

export const updateUserStatus = async (userId: string, data: UpdateStatusInput) => {
  return await api.patch<User>(`/admin/users/${userId}/status`, data);
};

export const resetUserPassword = async (userId: string, data: ResetPasswordInput) => {
  return await api.post<User>(`/admin/users/${userId}/reset-password`, data);
};
