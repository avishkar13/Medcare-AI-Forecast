import { prisma } from "../../config/prisma.js";
import { ConflictError, NotFoundError, ForbiddenError } from "../../utils/errors.js";
import type { CreateRoleInput, UpdateRoleInput } from "../../zod/admin/role.schema.js";

export const listRoles = async () => {
  const roles = await prisma.role.findMany({
    include: {
      _count: {
        select: { users: true, permissions: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return roles.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    isSystemRole: r.isSystemRole,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    userCount: r._count.users,
    permissionCount: r._count.permissions,
  }));
};

export const getRole = async (id: string) => {
  const role = await prisma.role.findUnique({
    where: { id },
    include: {
      permissions: {
        include: { permission: true },
      },
      _count: { select: { users: true } },
    },
  });

  if (!role) throw new NotFoundError(`Role '${id}' not found`);

  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isSystemRole: role.isSystemRole,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
    userCount: role._count.users,
    permissions: role.permissions.map((rp) => rp.permission),
  };
};

export const createRole = async (data: CreateRoleInput) => {
  const existing = await prisma.role.findFirst({
    where: { name: { equals: data.name, mode: "insensitive" } },
  });
  if (existing) throw new ConflictError(`Role '${data.name}' already exists`);

  const role = await prisma.role.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      isSystemRole: false,
    },
  });

  return role;
};

export const updateRole = async (id: string, data: UpdateRoleInput) => {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) throw new NotFoundError(`Role '${id}' not found`);

  if (role.isSystemRole && data.name && data.name !== role.name) {
    throw new ForbiddenError("Cannot rename a system baseline role");
  }

  if (data.name && data.name !== role.name) {
    const existing = await prisma.role.findFirst({
      where: { name: { equals: data.name, mode: "insensitive" } },
    });
    if (existing) throw new ConflictError(`Role '${data.name}' already exists`);
  }

  return prisma.role.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description ?? null } : {}),
    },
  });
};

export const deleteRole = async (id: string) => {
  const role = await prisma.role.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });
  
  if (!role) throw new NotFoundError(`Role '${id}' not found`);
  
  if (role.isSystemRole) {
    throw new ForbiddenError("Cannot delete a system baseline role");
  }

  if (role._count.users > 0) {
    throw new ConflictError("Cannot delete a role that is currently assigned to users");
  }

  await prisma.role.delete({ where: { id } });
  return { success: true };
};

export const listPermissions = async () => {
  return prisma.permission.findMany({
    orderBy: [{ module: "asc" }, { action: "asc" }],
  });
};

export const assignPermissions = async (roleId: string, permissionIds: string[]) => {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new NotFoundError(`Role '${roleId}' not found`);

  // Verify all permissions exist
  const existingPerms = await prisma.permission.findMany({
    where: { id: { in: permissionIds } },
    select: { id: true },
  });
  if (existingPerms.length !== permissionIds.length) {
    throw new ConflictError("One or more provided permission IDs do not exist");
  }

  // Use a transaction to replace permissions
  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId } }),
    prisma.rolePermission.createMany({
      data: permissionIds.map((permId) => ({
        roleId,
        permissionId: permId,
      })),
    }),
  ]);

  return getRole(roleId);
};

export const removePermission = async (roleId: string, permissionId: string) => {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new NotFoundError(`Role '${roleId}' not found`);

  const rp = await prisma.rolePermission.findUnique({
    where: { roleId_permissionId: { roleId, permissionId } },
  });
  
  if (!rp) throw new NotFoundError("Permission is not assigned to this role");

  await prisma.rolePermission.delete({
    where: { id: rp.id },
  });

  return { success: true };
};
