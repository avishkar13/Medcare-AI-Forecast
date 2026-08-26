import { api } from "./client";

export interface InventoryPosition {
  productId: string;
  sku: string;
  productName: string;
  category: string;
  criticality: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  tier: string;
  onHand: number;
  reserved: number;
  inTransit: number;
  available: number;
  safetyStock: number;
  reorderPoint: number;
  maximumInventory: number | null;
  avgDailyDemand: number;
  leadTimeDays: number;
  daysOfSupply: number;
  unitCost: number;
  inventoryValue: number;
  expiringUnits: number;
  expiringValue: number;
  bufferCoveragePercent: number;
  daysToNearestExpiry: number | null;
  status: string;
  risk: "critical" | "high" | "medium" | "low";
}

export interface InventoryTotals {
  positionCount: number;
  skuCount: number;
  warehouseCount: number;
  onHandUnits: number;
  inventoryValue: number;
  belowSafetyStockCount: number;
  belowReorderPointCount: number;
  aboveMaximumCount: number;
  expiringValue: number;
  inStockRatePercent: number;
}

export interface InventoryList {
  items: InventoryPosition[];
  totals: InventoryTotals;
}

export const listInventory = (params?: { pageSize?: number; page?: number }) =>
  api.get<InventoryList>("/inventory", params);

export interface InventoryHealth {
  breakdown: {
    criticalStock: number;
    belowReorderPoint: number;
    expiringSoon: number;
    excessStock: number;
    healthy: number;
    total: number;
  };
  breakdownPercent: {
    criticalStock: number;
    belowReorderPoint: number;
    expiringSoon: number;
    excessStock: number;
    healthy: number;
  };
  totalInventoryValue: number;
  conditions: Record<string, number>;
  byCategory: {
    category: string;
    skuCount: number;
    inventoryValue: number;
    atRiskCount: number;
    expiringValue: number;
  }[];
}

export const getInventoryHealth = () =>
  api.get<InventoryHealth>("/dashboard/inventory-health");

export interface InventoryBatch {
  batchId: string;
  batchNumber: string;
  warehouseCode: string;
  warehouseName: string;
  quantity: number;
  unitCost: number;
  valueAtRisk: number;
  manufacturingDate: string | null;
  expiryDate: string;
  daysToExpiry: number;
  severity: "critical" | "high" | "medium" | "low";
}

export interface SkuNetworkPosition {
  warehouseCount: number;
  onHand: number;
  available: number;
  safetyStock: number;
  reorderPoint: number;
  maximumInventory: number;
  avgDailyDemand: number;
  inventoryValue: number;
  expiringUnits: number;
  expiringValue: number;
  leadTimeDays: number;
  daysOfSupply: number;
  risk: "critical" | "high" | "medium" | "low";
  stockScaleUnits: number;
}

export interface InventoryDetail {
  product: {
    id: string;
    sku: string;
    name: string;
    category: string;
    unit: string;
    unitCost: number;
    shelfLifeDays: number;
    criticality: string;
  };
  totals: InventoryTotals;
  network: SkuNetworkPosition;
  positions: InventoryPosition[];
  batches: InventoryBatch[];
}

export const getInventoryDetail = (sku: string) =>
  api.get<InventoryDetail>(`/inventory/${encodeURIComponent(sku)}`);
