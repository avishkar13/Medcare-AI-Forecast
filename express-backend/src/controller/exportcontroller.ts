import type { Request, Response } from "express";
import { EXPORT_ROWS_HEADER } from "../config/constants.js";
import * as exports from "../services/export.service.js";
import { attachmentHeader } from "../utils/csv.js";
import { enforceScopeConflict } from "../middleware/scopeDc.js";
import { alertQuerySchema } from "../zod/alert.schemas.js";
import { inventoryQuerySchema } from "../zod/inventory.schemas.js";
import { recommendationQuerySchema } from "../zod/recommendation.schemas.js";

/**
 * The CSV exports.
 *
 * Each handler parses with the **same schema as its list route**, so a filter that
 * narrows the screen narrows the file identically, and an unknown filter is rejected
 * here exactly as it would be there.
 *
 * The whole file is built before a single byte is sent. That is deliberate and it is
 * the difference from `trainingcontroller.ts`: once headers are out, `errorHandler`
 * can only `next(error)` and the socket is destroyed, so a streamed export turns a
 * failure into a truncated file with a 200 on it. These are small enough to build
 * first, which keeps errors reportable.
 */

const send = (res: Response, file: exports.CsvExport) => {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", attachmentHeader(file.filename));
  // A reader can check this against the row count in the file to detect a truncated
  // download. Exposed via CORS, or the browser would not be able to read it.
  res.setHeader(EXPORT_ROWS_HEADER, String(file.rows));
  res.setHeader("Cache-Control", "no-store");
  res.send(file.body);
};

export const exportAlerts = async (req: Request, res: Response) => {
  const query = alertQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouseId, req);
  send(res, await exports.exportAlerts(query, { warehouseId: req.warehouseScope }));
};

export const exportInventory = async (req: Request, res: Response) => {
  const query = inventoryQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouse, req);
  send(res, await exports.exportInventory(query, { warehouseId: req.warehouseScope }));
};

export const exportRecommendations = async (req: Request, res: Response) => {
  const query = recommendationQuerySchema.parse(req.query);
  enforceScopeConflict(query.warehouse, req);
  send(res, await exports.exportRecommendations(query, { warehouseId: req.warehouseScope }));
};
