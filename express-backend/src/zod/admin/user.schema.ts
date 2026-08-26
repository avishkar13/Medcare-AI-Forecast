import { z } from "zod";

const text = z.string().trim().min(1);

export const userQuerySchema = z.object({
  roleId: text.optional(),
  warehouseId: text.optional(),
  active: z.stringbool().optional(),
});

export const createUserSchema = z.object({
  name: text,
  email: z.string().trim().email(),
  password: z.string().min(8),
  roleId: text,
  warehouseId: text.nullable().optional(),
});

export const updateUserSchema = z.object({
  name: text.optional(),
  roleId: text.optional(),
  warehouseId: text.nullable().optional(),
  active: z.boolean().optional(),
});

export const updateStatusSchema = z.object({
  active: z.boolean(),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8),
});

export const userParamsSchema = z.object({
  userId: text,
});

export type UserQuery = z.infer<typeof userQuerySchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UserParams = z.infer<typeof userParamsSchema>;
