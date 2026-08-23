import type { RequestHandler } from "express";
import { NotFoundError } from "../utils/errors.js";

export const notFound: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Cannot ${req.method} ${req.path}`));
};
