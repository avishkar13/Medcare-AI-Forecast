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
      select: { warehouseId: true, warehouse: { select: { id: true, code: true, name: true } } },
    });

    if (!userRecord) {
      return next(new UnauthorizedError("User no longer exists"));
    }

    req.warehouseScope = userRecord.warehouseId;
    // Resolved here rather than per request: the row is already loaded, and making
    // `enforceScopeConflict` async would put an await in front of every read route.
    req.warehouseScopeAliases = userRecord.warehouse
      ? [userRecord.warehouse.id, userRecord.warehouse.code, userRecord.warehouse.name].map(
          (alias) => alias.toLowerCase(),
        )
      : [];
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Validates that a requested warehouse does not conflict with the user's DC scope.
 *
 * The value may be an id, a code or a display name - `?warehouse=` accepts all three
 * (`inventory.service.ts` matches on any of them, `resolveWarehouse` on id or code),
 * so comparing against the id alone refused a confined caller who filtered by the
 * name of their own DC.
 *
 * @param requestedWarehouse The warehouse id, code or name requested by the client.
 * @param req The Express Request object containing the user's scope.
 * @throws ForbiddenError if the requested warehouse is not the user's own.
 */
export const enforceScopeConflict = (requestedWarehouse: string | undefined, req: Request) => {
  // Falsy covers both a network-wide caller (null) and a route mounted ahead of
  // `scopeDc` (undefined), neither of which is confined to anything.
  if (!req.warehouseScope || requestedWarehouse === undefined) return;

  if (!(req.warehouseScopeAliases ?? []).includes(requestedWarehouse.trim().toLowerCase())) {
    throw new ForbiddenError(
      `You are not authorized to access data for warehouse '${requestedWarehouse}'`,
    );
  }
};
