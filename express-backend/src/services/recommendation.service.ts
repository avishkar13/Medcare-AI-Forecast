import { prisma } from "../config/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { RecommendationStatus } from "../../generated/prisma/enums.js";
import { resolveActorId } from "../lib/actor.js";
import { ConflictError, NotFoundError } from "../utils/errors.js";
import { round } from "../utils/inventory.js";
import type {
  RecommendationParams,
  RecommendationQuery,
} from "../zod/recommendation.schemas.js";

/**
 * The review surface over a planning run's recommendations.
 *
 * Everything is read from `Recommendation` rows the executor wrote. Where a row did
 * not record a figure the answer is `null` - the route this replaces defaulted a
 * missing `impactValue` to 1000 and a missing confidence to 94, which put invented
 * money in front of a planner deciding what to act on.
 */

const PRIORITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;

const resolveRunId = async (runId?: string): Promise<string | null> => {
  if (runId) {
    const run = await prisma.planningRun.findUnique({
      where: { id: runId },
      select: { id: true, status: true },
    });
    if (!run) throw new NotFoundError(`Planning run '${runId}' not found`);
    return run.status === "COMPLETED" ? run.id : null;
  }

  const latest = await prisma.planningRun.findFirst({
    where: { status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    select: { id: true },
  });
  return latest?.id ?? null;
};

const resolveProduct = async (sku: string) => {
  const product = await prisma.product.findFirst({
    where: { OR: [{ id: sku }, { sku }] },
    select: { id: true },
  });
  if (!product) throw new NotFoundError(`Product '${sku}' not found`);
  return product.id;
};

const resolveWarehouse = async (warehouse: string) => {
  const row = await prisma.warehouse.findFirst({
    where: { OR: [{ id: warehouse }, { code: warehouse }] },
    select: { id: true },
  });
  if (!row) throw new NotFoundError(`Warehouse '${warehouse}' not found`);
  return row.id;
};

const whereOf = async (
  query: RecommendationQuery,
): Promise<{ where: Prisma.RecommendationWhereInput; runId: string | null }> => {
  const [runId, productId, warehouseId] = await Promise.all([
    resolveRunId(query.runId),
    query.sku === undefined ? undefined : resolveProduct(query.sku),
    query.warehouse === undefined ? undefined : resolveWarehouse(query.warehouse),
  ]);

  return {
    runId,
    where: {
      // No completed run means no recommendations, not every recommendation ever
      // written - a sentinel keeps the filter honest instead of matching everything.
      planningRunId: runId ?? "__no_completed_run__",
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.priority === undefined ? {} : { priority: query.priority }),
      ...(query.type === undefined ? {} : { type: query.type }),
      ...(productId === undefined ? {} : { productId }),
      ...(warehouseId === undefined ? {} : { warehouseId }),
    },
  };
};

const listSelect = {
  id: true,
  planningRunId: true,
  type: true,
  priority: true,
  status: true,
  message: true,
  quantity: true,
  actionType: true,
  confidence: true,
  expectedImpact: true,
  impactValue: true,
  acknowledgedAt: true,
  resolvedAt: true,
  actedById: true,
  createdAt: true,
  productId: true,
  warehouseId: true,
  product: { select: { sku: true, name: true, category: true, criticality: true } },
  warehouse: { select: { code: true, name: true, tier: true } },
  signals: { select: { id: true, type: true, label: true, direction: true } },
} satisfies Prisma.RecommendationSelect;

type ListedRow = Prisma.RecommendationGetPayload<{ select: typeof listSelect }>;

const toItem = (row: ListedRow) => ({
  id: row.id,
  planningRunId: row.planningRunId,
  type: row.type,
  actionType: row.actionType,
  priority: row.priority,
  status: row.status,
  message: row.message,
  quantity: row.quantity,
  // Null where the executor recorded nothing. A default would be a number a planner
  // could act on that no calculation ever produced.
  confidence: row.confidence,
  expectedImpact: row.expectedImpact,
  impactValue: row.impactValue,
  // Inline so a list needs no second call per row.
  productId: row.productId,
  sku: row.product.sku,
  productName: row.product.name,
  category: row.product.category,
  criticality: row.product.criticality,
  warehouseId: row.warehouseId,
  warehouseCode: row.warehouse.code,
  warehouseName: row.warehouse.name,
  tier: row.warehouse.tier,
  signals: row.signals,
  acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
  resolvedAt: row.resolvedAt?.toISOString() ?? null,
  actedById: row.actedById,
  createdAt: row.createdAt.toISOString(),
});

export const listRecommendations = async (query: RecommendationQuery) => {
  const { where, runId } = await whereOf(query);

  const [total, rows] = await Promise.all([
    prisma.recommendation.count({ where }),
    prisma.recommendation.findMany({
      where,
      select: listSelect,
      // Priority first, then money. Prisma cannot order by an enum's meaning, so the
      // page is ordered by impact in the database and re-sorted by priority here.
      orderBy: [{ impactValue: "desc" }, { createdAt: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  const items = rows
    .map(toItem)
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  return { items, total, planningRunId: runId };
};

export const getKpi = async (query: RecommendationQuery) => {
  const { where, runId } = await whereOf(query);

  const [total, byStatus, impact] = await Promise.all([
    prisma.recommendation.count({ where }),
    prisma.recommendation.groupBy({ by: ["status"], where, _count: true }),
    prisma.recommendation.aggregate({ where, _sum: { impactValue: true } }),
  ]);

  const counts = Object.fromEntries(byStatus.map((row) => [row.status, row._count]));
  const acted = (counts.COMPLETED ?? 0) + (counts.ACCEPTED ?? 0);

  return {
    planningRunId: runId,
    totalRecommendations: total,
    open: counts.OPEN ?? 0,
    accepted: counts.ACCEPTED ?? 0,
    completed: counts.COMPLETED ?? 0,
    rejected: counts.REJECTED ?? 0,
    /** Money the run attributed to these actions. Null when no row carried a figure. */
    potentialSavings: impact._sum.impactValue === null ? null : round(impact._sum.impactValue),
    executionRatePercent: total === 0 ? null : round((acted / total) * 100),
  };
};

export const getSummary = async (query: RecommendationQuery) => {
  const { where, runId } = await whereOf(query);

  const [byType, byPriority] = await Promise.all([
    prisma.recommendation.groupBy({
      by: ["type"],
      where,
      _count: true,
      _sum: { impactValue: true },
    }),
    prisma.recommendation.groupBy({ by: ["priority"], where, _count: true }),
  ]);

  return {
    planningRunId: runId,
    byType: byType.map((row) => ({
      type: row.type,
      count: row._count,
      impactValue: row._sum.impactValue === null ? null : round(row._sum.impactValue),
    })),
    byPriority: byPriority
      .map((row) => ({ priority: row.priority, count: row._count }))
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]),
  };
};

export const getImpact = async (query: RecommendationQuery) => {
  const { where, runId } = await whereOf(query);

  const [byType, optimization] = await Promise.all([
    prisma.recommendation.groupBy({
      by: ["type"],
      where,
      _sum: { impactValue: true },
      _count: true,
    }),
    runId === null
      ? null
      : prisma.optimizationResult.findUnique({ where: { planningRunId: runId } }),
  ]);

  const attributed = byType.reduce((total, row) => total + (row._sum.impactValue ?? 0), 0);

  return {
    planningRunId: runId,
    /** The run's own cost roll-up - the same number `/api/planning/runs/:id/compare` uses. */
    planCost: optimization
      ? {
          total: optimization.totalCost,
          holding: optimization.holdingCost,
          stockout: optimization.stockoutCost,
          transfer: optimization.transferCost,
          expiry: optimization.expiryCost,
        }
      : null,
    attributedImpact: round(attributed),
    byType: byType.map((row) => ({
      type: row.type,
      count: row._count,
      impactValue: row._sum.impactValue === null ? null : round(row._sum.impactValue),
      // Share of the attributed total, so the parts add to 100 rather than to a
      // set of fixed percentages that never referred to anything.
      sharePercent:
        attributed === 0 ? null : round(((row._sum.impactValue ?? 0) / attributed) * 100),
    })),
  };
};

export const getIntelligence = async (query: RecommendationQuery) => {
  const { where, runId } = await whereOf(query);

  const [confidence, signals, run] = await Promise.all([
    prisma.recommendation.aggregate({ where, _avg: { confidence: true }, _count: true }),
    prisma.recommendationSignal.groupBy({
      by: ["type"],
      where: { recommendation: where },
      _count: true,
    }),
    runId === null
      ? null
      : prisma.planningRun.findUnique({
          where: { id: runId },
          select: { modelVersion: true, horizonDays: true, completedAt: true },
        }),
  ]);

  return {
    planningRunId: runId,
    modelVersion: run?.modelVersion ?? null,
    horizonDays: run?.horizonDays ?? null,
    generatedAt: run?.completedAt?.toISOString() ?? null,
    recommendationCount: confidence._count,
    /** Mean of the confidences actually recorded; null when none were. */
    averageConfidence:
      confidence._avg.confidence === null ? null : round(confidence._avg.confidence, 3),
    // Which signals the executor cited, counted. The route this replaces returned a
    // fixed set of weights that no model produced.
    signalsCited: signals.map((row) => ({ type: row.type, count: row._count })),
  };
};

/** OPEN and ACCEPTED are still actionable; a resolved row is finished. */
const TRANSITIONS: Record<string, RecommendationStatus[]> = {
  execute: [RecommendationStatus.OPEN, RecommendationStatus.ACCEPTED],
  dismiss: [RecommendationStatus.OPEN, RecommendationStatus.ACCEPTED],
};

const applyAction = async (
  { id }: RecommendationParams,
  action: "execute" | "dismiss",
) => {
  const existing = await prisma.recommendation.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!existing) throw new NotFoundError(`Recommendation '${id}' not found`);

  // Without this an already-dismissed row could be executed, and `resolvedAt` would
  // move every time somebody clicked. The lifecycle is one-way.
  if (!TRANSITIONS[action]!.includes(existing.status)) {
    throw new ConflictError(
      `Recommendation '${id}' is ${existing.status} and cannot be ${action}d`,
      { id, status: existing.status },
    );
  }

  const now = new Date();
  const row = await prisma.recommendation.update({
    where: { id },
    data: {
      status:
        action === "execute" ? RecommendationStatus.COMPLETED : RecommendationStatus.REJECTED,
      resolvedAt: now,
      // Only stamped on the first acknowledgement, never moved by a later action.
      ...(existing.status === RecommendationStatus.OPEN ? { acknowledgedAt: now } : {}),
      // Placeholder until WP-16 lands real identity; `lib/actor.ts` is the one place
      // that decides who acted.
      actedById: await resolveActorId(),
    },
    select: listSelect,
  });

  return toItem(row);
};

export const executeRecommendation = (params: RecommendationParams) =>
  applyAction(params, "execute");

export const dismissRecommendation = (params: RecommendationParams) =>
  applyAction(params, "dismiss");
