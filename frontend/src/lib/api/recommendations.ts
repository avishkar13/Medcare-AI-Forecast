import { api } from "./client";

export interface Recommendation {
  id: string;
  planningRunId: string;
  type: string;
  actionType: string | null;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  status: "OPEN" | "ACCEPTED" | "REJECTED" | "COMPLETED";
  message: string;
  quantity: number | null;
  confidence: number | null;
  expectedImpact: string | null;
  impactValue: number | null;
  sku: string;
  productName: string;
  warehouseCode: string;
  warehouseName: string;
  createdAt: string;
}

export const listRecommendations = (params?: { pageSize?: number; status?: string }) =>
  api.getPage<Recommendation[]>("/recommendations", params);

export interface RecommendationImpactPayload {
  planningRunId: string | null;
  planCost: {
    total: number;
    holding: number;
    stockout: number;
    transfer: number;
    expiry: number;
  } | null;
  attributedImpact: number;
  byType: { type: string; count: number; impactValue: number | null; sharePercent: number | null }[];
}

export interface RecommendationIntelligencePayload {
  planningRunId: string | null;
  modelVersion: string | null;
  horizonDays: number | null;
  recommendationCount: number;
  averageConfidence: number | null;
  signalsCited: { type: string; count: number }[];
}

export const getImpact = () =>
  api.get<RecommendationImpactPayload>("/recommendations/impact");

export const getIntelligence = () =>
  api.get<RecommendationIntelligencePayload>("/recommendations/intelligence");

export const executeRecommendation = (id: string) =>
  api.patch<Recommendation>(`/recommendations/${id}/execute`);

export const dismissRecommendation = (id: string) =>
  api.patch<Recommendation>(`/recommendations/${id}/dismiss`);

// the ui uses display-cased vocabularies; the api uses enums. map at the boundary.
const ACTION: Record<string, "Replenish" | "Transfer" | "Reduce" | "Prioritize"> = {
  INCREASE_SUPPLY: "Replenish",
  REDUCE_SUPPLY: "Reduce",
  TRANSFER_STOCK: "Transfer",
  STOCKOUT_RISK: "Prioritize",
  EXPIRY_RISK: "Prioritize",
};

const STATUS: Record<string, "Pending" | "Executed" | "Dismissed"> = {
  OPEN: "Pending",
  ACCEPTED: "Pending",
  COMPLETED: "Executed",
  REJECTED: "Dismissed",
};

export const toRecommendationItem = (rec: Recommendation) => ({
  id: rec.id,
  title: rec.actionType ?? rec.type.replace(/_/g, " "),
  actionType: ACTION[rec.type] ?? "Prioritize",
  priority: (rec.priority.charAt(0) + rec.priority.slice(1).toLowerCase()) as
    | "Critical"
    | "High"
    | "Medium"
    | "Low",
  confidence: rec.confidence ?? 0,
  reason: rec.message,
  sku: rec.sku,
  location: rec.warehouseName,
  recommendedQuantity: rec.quantity ?? 0,
  expectedImpact: rec.expectedImpact ?? "",
  impactValue: rec.impactValue ?? 0,
  signals: [] as never[],
  status: STATUS[rec.status] ?? "Pending",
  createdAt: rec.createdAt,
});

export interface RecommendationKpi {
  planningRunId: string | null;
  totalRecommendations: number;
  open: number;
  accepted: number;
  completed: number;
  rejected: number;
  potentialSavings: number;
  executionRatePercent: number;
}

export interface RecommendationSummaryPayload {
  planningRunId: string | null;
  byType: { type: string; count: number; impactValue: number | null }[];
  byPriority: { priority: Recommendation["priority"]; count: number }[];
  byStatus: { status: Recommendation["status"]; count: number }[];
}

export const getKpi = () => api.get<RecommendationKpi>("/recommendations/kpi");

export const getSummary = () =>
  api.get<RecommendationSummaryPayload>("/recommendations/summary");
