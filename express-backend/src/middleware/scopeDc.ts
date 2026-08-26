import type { NextFunction, Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { ForbiddenError, UnauthorizedError } from "../utils/errors.js";

/**
 * Derives the DC scope for the authenticated user and attaches it to req.warehouseScope.
 * 
 * - If user.warehouseId is null, it signifies GLOBAL ACCESS (e.g. Admin), and req.warehouseScope becomes null.
 * - If user.warehouseId is set, it signifies SINGLE-DC ACCESS, and req.warehouseScope becomes that ID.
 * 
 * It must be run AFTER the authenticate middleware.
 */
export const scopeDc = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(new UnauthorizedError("Authentication required"));
    }

    // Always fetch the freshest assignment from the DB, do not trust a stale JWT.
    const userRecord = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { warehouseId: true }
    });

    if (!userRecord) {
      return next(new UnauthorizedError("User no longer exists"));
    }

    req.warehouseScope = userRecord.warehouseId;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Validates that a requested warehouseId (from query/body/path) does not conflict
 * with the user's DC scope.
 * 
 * @param requestedWarehouseId The warehouse ID requested by the client.
 * @param req The Express Request object containing the user's scope.
 * @throws ForbiddenError if the requested ID conflicts with the user's scope.
 */
export const enforceScopeConflict = (requestedWarehouseId: string | undefined, req: Request) => {
  if (req.warehouseScope !== null && requestedWarehouseId !== undefined && requestedWarehouseId !== req.warehouseScope) {
    throw new ForbiddenError(`You are not authorized to access data for warehouse '${requestedWarehouseId}'`);
  }
};
