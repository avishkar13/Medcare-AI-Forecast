import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { REQUEST_ID_HEADER } from "../config/constants.js";

const ID_PATTERN = /^[\w-]{8,64}$/;

export const requestContext: RequestHandler = (req, res, next) => {
  const incoming = req.get(REQUEST_ID_HEADER);
  req.id = incoming && ID_PATTERN.test(incoming) ? incoming : randomUUID();
  res.setHeader(REQUEST_ID_HEADER, req.id);
  next();
};
