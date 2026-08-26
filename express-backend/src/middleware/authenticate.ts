import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { UnauthorizedError } from "../utils/errors.js";

/**
 * Validates the JWT in the Authorization header and attaches the user to the request.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedError("Missing or invalid authorization header");
    }

    const token = authHeader.substring(7); // Remove "Bearer "
    const secret = (env as any).JWT_SECRET || "super_secret_jwt_key_for_development_purposes_only";

    let payload: string | jwt.JwtPayload;
    try {
      payload = jwt.verify(token, secret);
    } catch (err) {
      throw new UnauthorizedError("Invalid or expired token");
    }

    if (typeof payload === "string" || !payload.sub) {
      throw new UnauthorizedError("Invalid token payload");
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub as string },
      select: {
        id: true,
        name: true,
        email: true,
        roleId: true,
        warehouseId: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError("User no longer exists");
    }
    
    if (!user.isActive) {
      throw new UnauthorizedError("User account is deactivated");
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      roleId: user.roleId,
      warehouseId: user.warehouseId,
    };

    next();
  } catch (error) {
    next(error);
  }
}
