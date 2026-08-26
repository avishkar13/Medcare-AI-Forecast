import type { Request, Response, NextFunction } from "express";
import { login } from "../services/auth.service.js";
import { loginSchema } from "../zod/auth.schemas.js";

/**
 * Handles user authentication.
 */
export async function loginController(req: Request, res: Response, next: NextFunction) {
  try {
    const input = loginSchema.parse(req.body);
    const result = await login(input);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}
