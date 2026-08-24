import type { Response } from "express";
import type { ResponseMeta } from "../types.js";

type ExtraMeta = Omit<ResponseMeta, "generatedAt">;

export const ok = <T>(res: Response, data: T, meta?: ExtraMeta): Response =>
  res.json({ data, meta: { generatedAt: new Date().toISOString(), ...meta } });

export const paginated = <T>(
  res: Response,
  data: T[],
  page: number,
  pageSize: number,
  total: number,
): Response => ok(res, data, { page, pageSize, total });
