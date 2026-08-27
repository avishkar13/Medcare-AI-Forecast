import { z } from "zod";
import { riskLevelSchema } from "./inventory";

/**
 * The expiry boundary. Follows `schemas/alerts.ts`.
 *
 * `preventedWasteValue` and `preventedWasteUnits` are nullable on purpose and the
 * distinction is the whole point of the field: null means no prevention programme has
 * recorded anything, `0` means it recorded something and saved nothing. Rendering the
 * first as the second is the failure mode this file exists to stop.
 */

export const expiryBatchRowSchema = z.object({
  id: z.string(),
  batchNumber: z.string(),
  productId: z.string(),
  sku: z.string(),
  productName: z.string(),
  criticality: z.string(),
  warehouseCode: z.string(),
  warehouseName: z.string(),
  quantity: z.number(),
  unitCost: z.number(),
  inventoryValue: z.number(),
  manufacturingDate: z.string().nullable(),
  expiryDate: z.string(),
  daysRemaining: z.number(),
  riskLevel: riskLevelSchema,
  avgDailyDemand: z.number(),
  forecastDemand: z.number(),
  projectedWasteUnits: z.number(),
  projectedWasteValue: z.number(),
  demandCoveragePercent: z.number(),
  projectedWasteSharePercent: z.number(),
});

export const dcExposureSchema = z.object({
  warehouseId: z.string(),
  code: z.string(),
  name: z.string(),
  batchCount: z.number(),
  totalExposureValue: z.number(),
  criticalExposureValue: z.number(),
});

export const wastePreventionSchema = z.object({
  byAction: z.array(
    z.object({
      actionTaken: z.string(),
      recordCount: z.number(),
      unitsSaved: z.number(),
      valueSaved: z.number(),
      sharePercent: z.number(),
    }),
  ),
  items: z.array(
    z.object({
      id: z.string(),
      productName: z.string(),
      actionTaken: z.string(),
      unitsSaved: z.number(),
      valueSaved: z.number(),
      date: z.string(),
    }),
  ),
  totalUnitsSaved: z.number(),
  totalValueSaved: z.number(),
});

export const expiryOverviewSchema = z.object({
  batchesTracked: z.number(),
  unitsAtRisk: z.number(),
  totalAtRiskValue: z.number(),
  criticalBatches: z.number(),
  criticalAtRiskValue: z.number(),
  averageDaysToExpiry: z.number().nullable(),
  preventedWasteValue: z.number().nullable(),
  preventedWasteUnits: z.number().nullable(),
});

export const expiryTimelinePointSchema = z.object({
  month: z.string(),
  valueExpiring: z.number(),
  units: z.number(),
  batchCount: z.number(),
});

export const expiryAssessmentSchema = expiryOverviewSchema.extend({
  riskLevel: z.enum(["low", "moderate", "high"]),
  criticalSharePercent: z.number(),
  findings: z.array(z.object({ kind: z.string(), detail: z.string() })),
});

const exposureBucketFields = {
  value: z.number(),
  units: z.number(),
  batchCount: z.number(),
  sharePercent: z.number(),
};

export const expiryExposureSchema = z.object({
  totalExposureValue: z.number(),
  totalUnits: z.number(),
  byWindow: z.array(
    z.object({
      ...exposureBucketFields,
      label: z.string(),
      fromDays: z.number(),
      // Null on the open-ended final bucket.
      toDays: z.number().nullable(),
    }),
  ),
  byRisk: z.array(z.object({ ...exposureBucketFields, level: riskLevelSchema })),
});

export const expiryDemandCoverageSchema = z.object({
  batchesTracked: z.number(),
  unitsExpiring: z.number(),
  consumableUnits: z.number(),
  unusedUnits: z.number(),
  utilizationPercent: z.number(),
  wastedSharePercent: z.number(),
  valueAtRisk: z.number(),
  projectedWasteValue: z.number(),
  soonestExpiryDays: z.number().nullable(),
});

export type ExpiryBatchRow = z.infer<typeof expiryBatchRowSchema>;
export type DcExposure = z.infer<typeof dcExposureSchema>;
export type WastePrevention = z.infer<typeof wastePreventionSchema>;
export type WastePreventionAction = WastePrevention["byAction"][number];
export type ExpiryOverview = z.infer<typeof expiryOverviewSchema>;
export type ExpiryTimelinePoint = z.infer<typeof expiryTimelinePointSchema>;
export type ExpiryAssessment = z.infer<typeof expiryAssessmentSchema>;
export type ExpiryExposure = z.infer<typeof expiryExposureSchema>;
export type ExpiryExposureBucket = z.infer<typeof expiryExposureSchema>["byRisk"][number];
export type ExpiryDemandCoverage = z.infer<typeof expiryDemandCoverageSchema>;
