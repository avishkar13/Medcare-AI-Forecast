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
}

export interface DcExposure {
  warehouseId: string;
  code: string;
  name: string;
  batchCount: number;
  totalExposureValue: number;
  criticalExposureValue: number;
}

export interface WastePrevention {
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

export const listExpiryBatches = (params?: { pageSize?: number }) =>
  api.getPage<ExpiryBatchRow[]>("/expiry/batches", params);

export const getDcExposure = () => api.get<DcExposure[]>("/expiry/dc-exposure");

export const getWastePrevention = () =>
  api.get<WastePrevention>("/expiry/waste-prevention");
