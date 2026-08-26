import type { Request, Response, NextFunction } from "express";
import { ForbiddenError, UnauthorizedError } from "../utils/errors.js";
import { prisma } from "../config/prisma.js";

/**
 * Creates a middleware that checks if the authenticated user has the given permission.
 * It assumes `authenticate` has already populated `req.user`.
 * The permissions are fetched directly from the database to support dynamic RBAC.
 */
export const authorize = (requiredPermission: string) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new UnauthorizedError("Authentication required"));
      }

      const roleId = req.user.roleId;
      if (!roleId) {
        return next(new ForbiddenError("No role assigned"));
      }

      const rolePermissions = await prisma.rolePermission.findMany({
        where: { roleId },
        include: { permission: true },
      });

      const hasPermission = rolePermissions.some(
        (rp) => rp.permission.key === requiredPermission
      );

      if (!hasPermission) {
        return next(
          new ForbiddenError(`Insufficient permissions: missing '${requiredPermission}'`)
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
