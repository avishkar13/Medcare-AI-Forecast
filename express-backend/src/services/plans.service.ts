import { prisma } from "../config/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { PlanStatus } from "../../generated/prisma/enums.js";
import { ConflictError, NotFoundError } from "../utils/errors.js";
import { round } from "../utils/inventory.js";
import type { DrpQuery, SupplyPlanQuery } from "../zod/plans.schemas.js";

/**
 * The plan artefacts a run produced: what to order, and what to move.
 *
 * `SupplyPlan.status` was written `PROPOSED` by the executor and had no route to
 * change it, so an approval workflow existed in the schema and nowhere else.
 *
 * **Approving a plan does not move stock.** Nothing here writes `Inventory`,
 * `InventoryBatch` or `DistributorOrder` - the status records a decision, and
 * executing it is a separate system's job.
 */

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

// A run that never completed has unreachable artefacts, so the filter must match
// nothing rather than collapsing to every row ever written.
const NO_RUN = "__no_completed_run__";

const supplySelect = {
  id: true,
  planningRunId: true,
  productId: true,
  warehouseId: true,
  date: true,
  quantity: true,
  source: true,
  status: true,
  product: { select: { sku: true, name: true, criticality: true } },
  warehouse: { select: { code: true, name: true, tier: true } },
} satisfies Prisma.SupplyPlanSelect;

type SupplyRow = Prisma.SupplyPlanGetPayload<{ select: typeof supplySelect }>;

const toSupplyPlan = (row: SupplyRow) => ({
  id: row.id,
  planningRunId: row.planningRunId,
  productId: row.productId,
  sku: row.product.sku,
  productName: row.product.name,
  criticality: row.product.criticality,
  warehouseId: row.warehouseId,
  warehouseCode: row.warehouse.code,
  warehouseName: row.warehouse.name,
  tier: row.warehouse.tier,
  date: row.date.toISOString().slice(0, 10),
  quantity: round(row.quantity),
  source: row.source,
  status: row.status,
});

export const listSupplyPlans = async (query: SupplyPlanQuery, authScope?: { warehouseId?: string | null }) => {
  const effectiveWarehouse = query.warehouse ?? authScope?.warehouseId;
  const [runId, productId, warehouseId] = await Promise.all([
    resolveRunId(query.runId),
    query.sku === undefined ? undefined : resolveProduct(query.sku),
    effectiveWarehouse === undefined || effectiveWarehouse === null ? undefined : resolveWarehouse(effectiveWarehouse),
  ]);

  const where: Prisma.SupplyPlanWhereInput = {
    planningRunId: runId ?? NO_RUN,
    ...(productId === undefined ? {} : { productId }),
    ...(warehouseId === undefined ? {} : { warehouseId }),
    ...(query.status === undefined ? {} : { status: query.status }),
    ...(query.source === undefined ? {} : { source: query.source }),
  };

  const [total, rows] = await Promise.all([
    prisma.supplyPlan.count({ where }),
    prisma.supplyPlan.findMany({
      where,
      select: supplySelect,
      // Soonest first: the orders that have to be placed next.
      orderBy: [{ date: "asc" }, { quantity: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return { items: rows.map(toSupplyPlan), total, planningRunId: runId };
};

/** `PROPOSED` is the only actionable state; a decided plan is not re-decided. */
const SUPPLY_TRANSITIONS: Record<string, PlanStatus> = {
  approve: PlanStatus.APPROVED,
  reject: PlanStatus.REJECTED,
};

export const decideSupplyPlan = async (id: string, action: "approve" | "reject") => {
  const existing = await prisma.supplyPlan.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!existing) throw new NotFoundError(`Supply plan '${id}' not found`);

  if (existing.status !== PlanStatus.PROPOSED) {
    throw new ConflictError(
      `Supply plan '${id}' is ${existing.status} and cannot be ${action}d`,
      { id, status: existing.status },
    );
  }

  const row = await prisma.supplyPlan.update({
    where: { id },
    data: { status: SUPPLY_TRANSITIONS[action]! },
    select: supplySelect,
  });

  return toSupplyPlan(row);
};

const drpSelect = {
  id: true,
  planningRunId: true,
  productId: true,
  fromWarehouseId: true,
  toWarehouseId: true,
  date: true,
  quantity: true,
  reason: true,
  product: { select: { sku: true, name: true } },
  fromWarehouse: { select: { code: true, name: true } },
  toWarehouse: { select: { code: true, name: true } },
} satisfies Prisma.DRPPlanSelect;

export const listDrpPlans = async (query: DrpQuery, authScope?: { warehouseId?: string | null }) => {
  const effectiveWarehouse = query.warehouse ?? authScope?.warehouseId;
  const [runId, productId, warehouseId] = await Promise.all([
    resolveRunId(query.runId),
    query.sku === undefined ? undefined : resolveProduct(query.sku),
    effectiveWarehouse === undefined || effectiveWarehouse === null ? undefined : resolveWarehouse(effectiveWarehouse),
  ]);

  const where: Prisma.DRPPlanWhereInput = {
    planningRunId: runId ?? NO_RUN,
    ...(productId === undefined ? {} : { productId }),
    // A warehouse filter means "transfers this DC is party to", either end. Filtering
    // one side only would hide half of what a DC is being asked to do.
    ...(warehouseId === undefined
      ? {}
      : { OR: [{ fromWarehouseId: warehouseId }, { toWarehouseId: warehouseId }] }),
  };

  const [total, rows, totals] = await Promise.all([
    prisma.dRPPlan.count({ where }),
    prisma.dRPPlan.findMany({
      where,
      select: drpSelect,
      orderBy: [{ date: "asc" }, { quantity: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.dRPPlan.aggregate({ where, _sum: { quantity: true } }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      planningRunId: row.planningRunId,
      productId: row.productId,
      sku: row.product.sku,
      productName: row.product.name,
      fromWarehouseId: row.fromWarehouseId,
      fromWarehouseCode: row.fromWarehouse.code,
      fromWarehouseName: row.fromWarehouse.name,
      toWarehouseId: row.toWarehouseId,
      toWarehouseCode: row.toWarehouse.code,
      toWarehouseName: row.toWarehouse.name,
      date: row.date.toISOString().slice(0, 10),
      quantity: round(row.quantity),
      reason: row.reason,
    })),
    total,
    totalUnits: round(totals._sum.quantity ?? 0),
    planningRunId: runId,
  };
};
