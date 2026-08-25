import type { RequestHandler } from "express";
import { IS_PRODUCTION } from "../config/constants.js";
import { fallbackUserId } from "../lib/actor.js";

const USER_HEADER = "x-user-id";

/**
 * Puts the acting user on the request.
 *
 * There is no authentication yet, so this fills `req.userId` with a stand-in. When
 * auth is added, its middleware sets `req.user` ahead of this one and `req.userId`
 * becomes the authenticated id automatically - every route that records an actor
 * keeps working untouched.
 *
 * Outside production an `x-user-id` header can override the stand-in, which makes
 * the recommendation and alert lifecycles testable with more than one actor. It is
 * only consulted when nothing has authenticated, so it can never shadow a real user.
 */
export const currentUser: RequestHandler = (req, _res, next) => {
  if (req.user?.id) {
    req.userId = req.user.id;
    next();
    return;
  }

  const header = IS_PRODUCTION ? undefined : req.get(USER_HEADER)?.trim();
  if (header) {
    req.userId = header;
    next();
    return;
  }

  fallbackUserId()
    .then((id) => {
      req.userId = id;
      next();
    })
    .catch(next);
};
