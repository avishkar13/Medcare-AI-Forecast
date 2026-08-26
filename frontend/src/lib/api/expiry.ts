import { api } from "./client";

export interface ExpiryBatchRow {
  id: string;
  batchNumber: string;
  productId: string;
  sku: string;
  productName: string;
  criticality: string;
  warehouseCode: string;
  warehouseName: string;
  quantity: number;
  unitCost: number;
  inventoryValue: number;
  manufacturingDate: string | null;
  expiryDate: string;
  daysRemaining: number;
  riskLevel: "critical" | "high" | "medium" | "low";
  avgDailyDemand: number;
  forecastDemand: number;
  projectedWasteUnits: number;
  projectedWasteValue: number;
  demandCoveragePercent: number;
  projectedWasteSharePercent: number;
}

export interface DcExposure {
  warehouseId: string;
  code: string;
  name: string;
  batchCount: number;
  totalExposureValue: number;
  criticalExposureValue: number;
}

export interface WastePreventionAction {
  actionTaken: string;
  recordCount: number;
  unitsSaved: number;
  valueSaved: number;
  sharePercent: number;
}

export interface WastePrevention {
  byAction: WastePreventionAction[];
  items: {
    id: string;
    productName: string;
    actionTaken: string;
    unitsSaved: number;
    valueSaved: number;
    date: string;
  }[];
  totalUnitsSaved: number;
  totalValueSaved: number;
}

export const listExpiryBatches = (params?: { page?: number; pageSize?: number }) =>
  api.getPage<ExpiryBatchRow[]>("/expiry/batches", params);

// the page cap is 200 and there are more batches than that. anything that buckets
// the whole book needs every page, not the first one.
export const listAllExpiryBatches = async () => {
  const rows: ExpiryBatchRow[] = [];

  for (let page = 1; page <= 20; page += 1) {
    const result = await listExpiryBatches({ page, pageSize: 200 });
    rows.push(...result.data);
    if (result.data.length === 0 || rows.length >= (result.meta.total ?? rows.length)) break;
  }

  return rows;
};

export const getDcExposure = () => api.get<DcExposure[]>("/expiry/dc-exposure");

export const getWastePrevention = () =>
  api.get<WastePrevention>("/expiry/waste-prevention");

export interface ExpiryOverview {
  batchesTracked: number;
  unitsAtRisk: number;
  totalAtRiskValue: number;
  criticalBatches: number;
  criticalAtRiskValue: number;
  averageDaysToExpiry: number | null;
  preventedWasteValue: number | null;
  preventedWasteUnits: number | null;
}

export interface ExpiryTimelinePoint {
  month: string;
  valueExpiring: number;
  units: number;
  batchCount: number;
}

export interface ExpiryAssessment extends ExpiryOverview {
  riskLevel: "low" | "moderate" | "high";
  criticalSharePercent: number;
  findings: { kind: string; detail: string }[];
}

export interface ExpiryExposureBucket {
  value: number;
  units: number;
  batchCount: number;
  sharePercent: number;
}

export interface ExpiryExposure {
  totalExposureValue: number;
  totalUnits: number;
  byWindow: (ExpiryExposureBucket & { label: string; fromDays: number; toDays: number | null })[];
  byRisk: (ExpiryExposureBucket & { level: "critical" | "high" | "medium" | "low" })[];
}

export interface ExpiryDemandCoverage {
  batchesTracked: number;
  unitsExpiring: number;
  consumableUnits: number;
  unusedUnits: number;
  utilizationPercent: number;
  wastedSharePercent: number;
  valueAtRisk: number;
  projectedWasteValue: number;
  soonestExpiryDays: number | null;
}

export const getExpiryExposure = () => api.get<ExpiryExposure>("/expiry/exposure");

export const getExpiryDemandCoverage = () =>
  api.get<ExpiryDemandCoverage>("/expiry/demand-coverage");

export const getExpiryOverview = () => api.get<ExpiryOverview>("/expiry/overview");

export const getExpiryTimeline = () => api.get<ExpiryTimelinePoint[]>("/expiry/timeline");

export const getExpiryAssessment = () => api.get<ExpiryAssessment>("/expiry/ai-assessment");
