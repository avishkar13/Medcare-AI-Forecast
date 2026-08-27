import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { UnauthorizedError } from "../utils/errors.js";
import type { LoginInput } from "../zod/auth.schemas.js";

/**
 * Normalizes an email for consistent lookup.
 */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Authenticates a user and generates a JWT.
 */
export async function login(input: LoginInput) {
  const email = normalizeEmail(input.email);

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new UnauthorizedError("Invalid email or password");
  }

  if (!user.isActive) {
    throw new UnauthorizedError("User account is deactivated");
  }

  const isValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!isValid) {
    throw new UnauthorizedError("Invalid email or password");
  }

  // Use the secret from env
  const secret = (env as any).JWT_SECRET || "super_secret_jwt_key_for_development_purposes_only";
  const expiresIn = (env as any).JWT_EXPIRES_IN || "1d";

  const token = jwt.sign({ sub: user.id }, secret, { expiresIn });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      roleId: user.roleId,
      warehouseId: user.warehouseId,
      role: {
        id: user.role.id,
        name: user.role.name,
      },
      permissions: user.role.permissions.map((rp) => rp.permission.key),
    },
    token,
  };
}
