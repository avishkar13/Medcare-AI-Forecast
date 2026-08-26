import bcrypt from "bcryptjs";
import { prisma } from "../../config/prisma.js";
import { ConflictError, NotFoundError, ForbiddenError } from "../../utils/errors.js";
import type { CreateUserInput, UpdateUserInput, UserQuery } from "../../zod/admin/user.schema.js";

const excludePassword = <T extends { passwordHash: string }>(user: T): Omit<T, "passwordHash"> => {
  const { passwordHash, ...rest } = user;
  return rest;
};

export const listUsers = async (query: UserQuery) => {
  const users = await prisma.user.findMany({
    where: {
      ...(query.roleId ? { roleId: query.roleId } : {}),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.active !== undefined ? { isActive: query.active } : {}),
    },
    include: {
      role: { select: { id: true, name: true, isSystemRole: true } },
      warehouse: { select: { id: true, code: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return users.map(excludePassword);
};

export const createUser = async (data: CreateUserInput) => {
  const existing = await prisma.user.findUnique({
    where: { email: data.email },
  });
  if (existing) throw new ConflictError("Email is already in use");

  const role = await prisma.role.findUnique({ where: { id: data.roleId } });
  if (!role) throw new NotFoundError("Role not found");

  if (data.warehouseId) {
    const warehouse = await prisma.warehouse.findUnique({ where: { id: data.warehouseId } });
    if (!warehouse) throw new NotFoundError("Warehouse not found");
  } else if (!role.isSystemRole || role.name !== "ADMIN") {
    // Basic business rule: Non-admins generally need a warehouse, but we won't strictly forbid it 
    // unless the application enforces it. We'll allow it based on the schema (which allows null).
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(data.password, salt);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email.toLowerCase(),
      passwordHash,
      roleId: data.roleId,
      warehouseId: data.warehouseId ?? null,
      isActive: true,
    },
    include: {
      role: { select: { id: true, name: true, isSystemRole: true } },
      warehouse: { select: { id: true, code: true, name: true } },
    },
  });

  return excludePassword(user);
};

export const updateUser = async (id: string, data: UpdateUserInput) => {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { role: true },
  });
  if (!user) throw new NotFoundError("User not found");

  // Prevent modifying the final active ADMIN user
  if (user.role.name === "ADMIN" && user.isActive) {
    const activeAdmins = await prisma.user.count({
      where: { role: { name: "ADMIN" }, isActive: true },
    });
    
    if (activeAdmins <= 1) {
      if (data.active === false || (data.roleId && data.roleId !== user.roleId)) {
        throw new ForbiddenError("Cannot deactivate or change role of the last active ADMIN user");
      }
    }
  }

  if (data.roleId && data.roleId !== user.roleId) {
    const role = await prisma.role.findUnique({ where: { id: data.roleId } });
    if (!role) throw new NotFoundError("Role not found");
  }

  if (data.warehouseId) {
    const warehouse = await prisma.warehouse.findUnique({ where: { id: data.warehouseId } });
    if (!warehouse) throw new NotFoundError("Warehouse not found");
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.roleId !== undefined ? { roleId: data.roleId } : {}),
      ...(data.warehouseId !== undefined ? { warehouseId: data.warehouseId ?? null } : {}),
      ...(data.active !== undefined ? { isActive: data.active } : {}),
    },
    include: {
      role: { select: { id: true, name: true, isSystemRole: true } },
      warehouse: { select: { id: true, code: true, name: true } },
    },
  });

  return excludePassword(updatedUser);
};

export const resetPassword = async (id: string, newPassword: string) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError("User not found");

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(newPassword, salt);

  await prisma.user.update({
    where: { id },
    data: { passwordHash },
  });

  return { success: true };
};
