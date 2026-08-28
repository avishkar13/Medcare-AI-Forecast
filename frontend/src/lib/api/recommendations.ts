import { api } from "./client";
import type { QueryParams } from "./types";
import {
  recommendationImpactSchema,
  recommendationIntelligenceSchema,
  recommendationKpiSchema,
  recommendationSchema,
  recommendationSummarySchema,
  type Recommendation,
} from "@/schemas/recommendations";
import type { RecommendationSignal } from "@/types/recommendation";

export type {
  Recommendation,
  RecommendationImpactPayload,
  RecommendationIntelligencePayload,
  RecommendationKpi,
  RecommendationPriority,
  RecommendationStatus,
  RecommendationSummaryPayload,
} from "@/schemas/recommendations";

/**
 * Filters are applied by the server. `warehouse` accepts an id, a code or a name.
 */
export interface RecommendationListParams extends QueryParams {
  status?: string;
  priority?: string;
  type?: string;
  warehouse?: string;
  /** The backend narrows on this; it was missing here, so no caller could send it. */
  sku?: string;
  runId?: string;
  page?: number;
  pageSize?: number;
}

/**
 * A list is validated per row and bad rows are dropped rather than failing the page:
 * one malformed recommendation should not blank the whole review surface, and the
 * console line is what makes the drift visible.
 */
const parseList = (rows: unknown): Recommendation[] => {
  if (!Array.isArray(rows)) return [];

  const parsed: Recommendation[] = [];
  for (const row of rows) {
    const result = recommendationSchema.safeParse(row);
    if (result.success) parsed.push(result.data);
    else
      console.error(
        "dropped a recommendation that did not match the contract",
        result.error.issues,
      );
  }
  return parsed;
};

export const listRecommendations = async (params?: RecommendationListParams) => {
  const page = await api.getPage<unknown>("/recommendations", params);
  return { ...page, data: parseList(page.data) };
};

export const getImpact = async (params?: RecommendationListParams) =>
  recommendationImpactSchema.parse(await api.get<unknown>("/recommendations/impact", params));

export const getIntelligence = async (params?: RecommendationListParams) =>
  recommendationIntelligenceSchema.parse(
    await api.get<unknown>("/recommendations/intelligence", params),
  );

export const getKpi = async (params?: RecommendationListParams) =>
  recommendationKpiSchema.parse(await api.get<unknown>("/recommendations/kpi", params));

export const getSummary = async (params?: RecommendationListParams) =>
  recommendationSummarySchema.parse(
    await api.get<unknown>("/recommendations/summary", params),
  );

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

export const toRecommendationItem = (rec: Recommendation) => {
  const typeStr = rec.type ?? "STOCKOUT_RISK";
  const priorityStr = rec.priority ?? "LOW";
  const statusStr = rec.status ?? "OPEN";

  return {
    id: rec.id,
    title: rec.actionType ?? typeStr.replace(/_/g, " "),
    actionType: ACTION[typeStr] ?? "Prioritize",
    priority: (priorityStr.charAt(0) + priorityStr.slice(1).toLowerCase()) as
      | "Critical"
      | "High"
      | "Medium"
      | "Low",
    confidence: rec.confidence ?? 0,
    reason: rec.message ?? "",
    sku: rec.sku,
    productName: rec.productName ?? "Unknown Product",
    category: rec.category ?? "Uncategorized",
    location: rec.warehouseName ?? "Unknown Location",
    recommendedQuantity: rec.quantity ?? 0,
    expectedImpact: rec.expectedImpact ?? "",
    impactValue: rec.impactValue ?? 0,
    // The executor's cited signals, which the card has always been able to render.
    // This was hardcoded to `[]` while every row arrived carrying them.
    signals: (rec.signals ?? []) as RecommendationSignal[],
    status: STATUS[statusStr] ?? "Pending",
    createdAt: rec.createdAt ?? new Date().toISOString(),
  };
};
