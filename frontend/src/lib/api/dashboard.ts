import { api } from "./client";
import type { DashboardKPIs, NetworkHealth } from "@/types/inventory";

export interface DashboardSummary {
  kpis: DashboardKPIs;
  networkHealth: NetworkHealth;
}

export const getSummary = () => api.get<DashboardSummary>("/dashboard/summary");

export interface NetworkCenter {
  id: string;
  code: string;
  name: string;
  region: string | null;
  tier: string;
  capacity: number;
  skuCount: number;
  onHandUnits: number;
  utilization: number;
  inventoryValue: number;
  belowReorderPointCount: number;
  belowSafetyStockCount: number;
  stockoutRisk: number;
  shortageValue: number;
  excessValue: number;
  expiringValue: number;
}

export const getNetwork = () => api.get<NetworkCenter[]>("/dashboard/network");

export interface PriorityAction {
  id: string;
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  sku: string;
  productName: string;
  warehouseCode: string;
  warehouseName: string;
  problem: string;
  recommendedAction: string;
  quantity: number | null;
  impactValue: number | null;
  sourceWarehouseCode: string | null;
}

export interface PriorityActions {
  items: PriorityAction[];
  counts: { critical: number; high: number; medium: number; low: number; total: number };
}

export const getPriorityActions = () =>
  api.get<PriorityActions>("/dashboard/priority-actions");

export interface ExpiryRiskItem {
  batchId: string;
  batchNumber: string;
  sku: string;
  productName: string;
  warehouseCode: string;
  warehouseName: string;
  quantity: number;
  valueAtRisk: number;
  expiryDate: string;
  daysToExpiry: number;
  severity: "critical" | "high" | "medium" | "low";
  projectedWaste: number;
  projectedWasteValue: number;
}

export interface ExpiryRisk {
  items: ExpiryRiskItem[];
  totals: {
    batchCount: number;
    quantity: number;
    valueAtRisk: number;
    projectedWaste: number;
    projectedWasteValue: number;
  };
}

export const getExpiryRisk = () => api.get<ExpiryRisk>("/dashboard/expiry-risk");
