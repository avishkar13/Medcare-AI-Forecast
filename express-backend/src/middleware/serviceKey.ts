import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { IS_PRODUCTION, TRAINING_API_KEY } from "../config/constants.js";
import { UnauthorizedError } from "../utils/errors.js";

/**
 * Machine-to-machine access for the forecasting engine.
 *
 * The engine is not a person. It has no session, no role and nothing to authorise
 * against, so putting it through `authenticate` + `authorize("forecast:view")` meant
 * giving a background service a user account and a password to rotate. A shared key
 * on a single route is the smaller mechanism.
 *
 * It is a *narrower* exemption than it looks. `/api/training-data` exports the whole
 * demand history of the business, so this route is not simply opened: it swaps one
 * credential for another, and the key is mandatory in production - see the
 * `superRefine` in `zod/env.schemas.ts`. Unset outside production it waves callers
 * through, which is what makes `pnpm dev` and the test suite work without ceremony.
 */
const matches = (provided: string, expected: string): boolean => {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // Compare lengths first: timingSafeEqual throws on a mismatch rather than
  // returning false, and the length itself is not the secret.
  return a.length === b.length && timingSafeEqual(a, b);
};

export const requireServiceKey = (req: Request, _res: Response, next: NextFunction) => {
  if (TRAINING_API_KEY === undefined) {
    // Cannot happen in production - the env schema refuses to boot without it.
    if (IS_PRODUCTION) {
      return next(new UnauthorizedError("Service key is not configured"));
    }
    return next();
  }

  const provided = req.header("x-service-key");
  if (!provided || !matches(provided, TRAINING_API_KEY)) {
    return next(new UnauthorizedError("Missing or invalid service key"));
  }

  next();
};
