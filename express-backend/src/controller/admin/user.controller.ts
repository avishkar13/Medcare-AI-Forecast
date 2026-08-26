import type { Request, Response } from "express";
import * as userService from "../../services/admin/user.service.js";
import { ok } from "../../utils/response.js";
import {
  userQuerySchema,
  createUserSchema,
  updateUserSchema,
  updateStatusSchema,
  resetPasswordSchema,
  userParamsSchema,
} from "../../zod/admin/user.schema.js";

export const listUsers = async (req: Request, res: Response) => {
  const query = userQuerySchema.parse(req.query);
  ok(res, await userService.listUsers(query));
};

export const createUser = async (req: Request, res: Response) => {
  const body = createUserSchema.parse(req.body);
  res.status(201).json({ data: await userService.createUser(body) });
};

export const updateUser = async (req: Request, res: Response) => {
  const { userId } = userParamsSchema.parse(req.params);
  const body = updateUserSchema.parse(req.body);
  ok(res, await userService.updateUser(userId, body));
};

export const deactivateUser = async (req: Request, res: Response) => {
  const { userId } = userParamsSchema.parse(req.params);
  const body = updateStatusSchema.parse(req.body);
  ok(res, await userService.updateUser(userId, { active: body.active }));
};

export const resetPassword = async (req: Request, res: Response) => {
  const { userId } = userParamsSchema.parse(req.params);
  const body = resetPasswordSchema.parse(req.body);
  ok(res, await userService.resetPassword(userId, body.password));
};
