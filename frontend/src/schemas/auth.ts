import { z } from "zod";

/**
 * A mirror of `express-backend/src/zod/auth.schemas.ts`.
 *
 * Kept identical on purpose. The form used to accept anything non-empty and let the
 * server decide, so `ID-8924` - which the placeholder actively suggested - reached the
 * API and came back as a 400 the user could do nothing with. Validating here turns
 * that into a field-level message before a request is made.
 *
 * `password` is `min(1)` and nothing more. A login form must not enforce a policy
 * stronger than the one the account was created under, or an existing valid password
 * becomes unusable.
 */
export const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** Field name -> first message, which is the shape the form renders. */
export type LoginFieldErrors = Partial<Record<keyof LoginInput, string>>;

export const validateLogin = (
  input: LoginInput,
): { ok: true; data: LoginInput } | { ok: false; errors: LoginFieldErrors } => {
  const result = loginSchema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };

  const errors: LoginFieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    // First message per field wins; a second one for the same input is noise.
    if ((field === "email" || field === "password") && errors[field] === undefined) {
      errors[field] = issue.message;
    }
  }
  return { ok: false, errors };
};
