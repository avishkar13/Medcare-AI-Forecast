import type { RequestHandler } from "express";
import { UnauthorizedError } from "../utils/errors.js";

/**
 * Puts the acting user on the request.
 *
 * Auth middleware sets `req.user` ahead of this one and `req.userId`
 * becomes the authenticated id automatically - every route that records an actor
 * keeps working untouched.
 */
export const currentUser: RequestHandler = (req, _res, next) => {
  if (req.user?.id) {
    req.userId = req.user.id;
    next();
    return;
  }

  // If there's no authenticated user, the request should fail early.
  // This serves as an extra guard if authenticate middleware is skipped.
  next(new UnauthorizedError("Authentication required"));
};
