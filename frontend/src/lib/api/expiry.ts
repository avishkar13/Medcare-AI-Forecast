import { api } from "./client";
import type { QueryParams } from "./types";
import { z } from "zod";
import {
  dcExposureSchema,
  expiryAssessmentSchema,
  expiryBatchRowSchema,
  expiryDemandCoverageSchema,
  expiryExposureSchema,
  expiryOverviewSchema,
  expiryTimelinePointSchema,
  wastePreventionSchema,
  type ExpiryBatchRow,
} from "@/schemas/expiry";

export type {
  DcExposure,
  ExpiryAssessment,
  ExpiryBatchRow,
  ExpiryDemandCoverage,
  ExpiryExposure,
  ExpiryExposureBucket,
  ExpiryOverview,
  ExpiryTimelinePoint,
  WastePrevention,
  WastePreventionAction,
} from "@/schemas/expiry";

/** `warehouse` accepts an id, a code or a display name. */
export interface ExpiryParams extends QueryParams {
  warehouse?: string;
  sku?: string;
  withinDays?: number;
  risk?: string;
  page?: number;
  pageSize?: number;
}

/**
 * A list is validated per row and bad rows are dropped rather than failing the page.
 */
const parseBatches = (rows: unknown): ExpiryBatchRow[] => {
  if (!Array.isArray(rows)) return [];

  const parsed: ExpiryBatchRow[] = [];
  for (const row of rows) {
    const result = expiryBatchRowSchema.safeParse(row);
    if (result.success) parsed.push(result.data);
    else console.error("dropped an expiry batch that did not match the contract", result.error.issues);
  }
  return parsed;
};

export const listExpiryBatches = async (params?: ExpiryParams) => {
  const page = await api.getPage<unknown>("/expiry/batches", params);
  return { ...page, data: parseBatches(page.data) };
};

// the page cap is 200 and there are more batches than that. anything that buckets
// the whole book needs every page, not the first one.

export const getDcExposure = async (params?: ExpiryParams) =>
  z.array(dcExposureSchema).parse(await api.get<unknown>("/expiry/dc-exposure", params));

export const getWastePrevention = async (params?: ExpiryParams) =>
  wastePreventionSchema.parse(await api.get<unknown>("/expiry/waste-prevention", params));

export const getExpiryExposure = async (params?: ExpiryParams) =>
  expiryExposureSchema.parse(await api.get<unknown>("/expiry/exposure", params));

export const getExpiryDemandCoverage = async (params?: ExpiryParams) =>
  expiryDemandCoverageSchema.parse(await api.get<unknown>("/expiry/demand-coverage", params));

export const getExpiryOverview = async (params?: ExpiryParams) =>
  expiryOverviewSchema.parse(await api.get<unknown>("/expiry/overview", params));

export const getExpiryTimeline = async (params?: ExpiryParams) =>
  z.array(expiryTimelinePointSchema).parse(await api.get<unknown>("/expiry/timeline", params));

export const getExpiryAssessment = async (params?: ExpiryParams) =>
  expiryAssessmentSchema.parse(await api.get<unknown>("/expiry/ai-assessment", params));
