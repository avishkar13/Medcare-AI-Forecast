import { prisma } from "../config/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { RestockStatus } from "../../generated/prisma/enums.js";
import { ConflictError, NotFoundError } from "../utils/errors.js";
import { round } from "../utils/inventory.js";
import type { RestockQuery, RestockRequestBody } from "../zod/movement.schemas.js";

/**
 * Restock requests. Phase 3.5.
 *
 * A human asking for stock, as distinct from a `SupplyPlan`, which the executor
 * proposes. Both end up as "something should arrive here", but they answer to
 * different people and only one of them can be argued with, so they are separate
 * tables rather than a flag on one.
 *
 * The lifecycle is one-way and mirrors `SupplyPlan`'s, so a review surface can render
 * both the same way:
 *
 *   REQUESTED -> APPROVED -> FULFILLED
 *   REQUESTED -> REJECTED
 *
 * Nothing here moves stock. `FULFILLED` is reached by recording the arriving movement,
 * which is what actually changes `Inventory` - the same boundary the executor respects.
 */

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

const restockSelect = {
  id: true,
  productId: true,
  warehouseId: true,
  quantity: true,
  status: true,
  reason: true,
  notes: true,
  requestedById: true,
  decidedById: true,
  decidedAt: true,
  fulfilledAt: true,
  fulfillmentMovementId: true,
  createdAt: true,
  updatedAt: true,
  product: { select: { sku: true, name: true, criticality: true } },
  warehouse: { select: { code: true, name: true, tier: true } },
} satisfies Prisma.RestockRequestSelect;

type RestockRow = Prisma.RestockRequestGetPayload<{ select: typeof restockSelect }>;

const toRestock = (row: RestockRow) => ({
  id: row.id,
  productId: row.productId,
  sku: row.product.sku,
  productName: row.product.name,
  criticality: row.product.criticality,
  warehouseId: row.warehouseId,
  warehouseCode: row.warehouse.code,
  warehouseName: row.warehouse.name,
  tier: row.warehouse.tier,
  quantity: round(row.quantity),
  status: row.status,
  reason: row.reason,
  notes: row.notes,
  requestedById: row.requestedById,
  decidedById: row.decidedById,
  decidedAt: row.decidedAt?.toISOString() ?? null,
  fulfilledAt: row.fulfilledAt?.toISOString() ?? null,
  fulfillmentMovementId: row.fulfillmentMovementId,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const createRestockRequest = async (
  body: RestockRequestBody,
  actorId?: string,
  authScope?: { warehouseId?: string | null },
) => {
  const requested = authScope?.warehouseId ?? body.warehouse;
  const [productId, warehouseId] = await Promise.all([
    resolveProduct(body.sku),
    resolveWarehouse(requested),
  ]);

  const row = await prisma.restockRequest.create({
    data: {
      productId,
      warehouseId,
      quantity: body.quantity,
      ...(body.reason === undefined ? {} : { reason: body.reason }),
      ...(body.notes === undefined ? {} : { notes: body.notes }),
      ...(actorId === undefined ? {} : { requestedById: actorId }),
    },
    select: restockSelect,
  });

  return toRestock(row);
};

export const listRestockRequests = async (
  query: RestockQuery,
  authScope?: { warehouseId?: string | null },
) => {
  const requested = authScope?.warehouseId ?? query.warehouse;

  const [productId, warehouseId] = await Promise.all([
    query.sku === undefined ? undefined : resolveProduct(query.sku),
    requested === undefined || requested === null ? undefined : resolveWarehouse(requested),
  ]);

  const where: Prisma.RestockRequestWhereInput = {
    ...(productId === undefined ? {} : { productId }),
    ...(warehouseId === undefined ? {} : { warehouseId }),
    ...(query.status === undefined ? {} : { status: query.status as RestockStatus }),
  };

  const [total, rows] = await Promise.all([
    prisma.restockRequest.count({ where }),
    prisma.restockRequest.findMany({
      where,
      select: restockSelect,
      // Open requests first, then newest: a review surface is about what still needs
      // deciding, not about what was decided last week.
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return { items: rows.map(toRestock), total };
};

/** `REQUESTED` is the only actionable state; a decided request is not re-decided. */
const TRANSITIONS: Record<string, RestockStatus> = {
  approve: RestockStatus.APPROVED,
  reject: RestockStatus.REJECTED,
};

export const decideRestockRequest = async (
  id: string,
  action: "approve" | "reject",
  actorId?: string,
) => {
  const existing = await prisma.restockRequest.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!existing) throw new NotFoundError(`Restock request '${id}' not found`);

  if (existing.status !== RestockStatus.REQUESTED) {
    throw new ConflictError(
      `Restock request '${id}' is ${existing.status} and cannot be ${action}d`,
      { id, status: existing.status },
    );
  }

  const row = await prisma.restockRequest.update({
    where: { id },
    data: {
      status: TRANSITIONS[action]!,
      decidedAt: new Date(),
      ...(actorId === undefined ? {} : { decidedById: actorId }),
    },
    select: restockSelect,
  });

  return toRestock(row);
};

/**
 * Closes a request against the movement that satisfied it.
 *
 * Only an `APPROVED` request can be fulfilled: fulfilling a `REQUESTED` one would
 * record stock arriving against a decision nobody made, and fulfilling a `REJECTED`
 * one would contradict the rejection.
 */
export const fulfilRestockRequest = async (id: string, movementId: string) => {
  const existing = await prisma.restockRequest.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!existing) throw new NotFoundError(`Restock request '${id}' not found`);

  if (existing.status !== RestockStatus.APPROVED) {
    throw new ConflictError(
      `Restock request '${id}' is ${existing.status} and cannot be fulfilled`,
      { id, status: existing.status },
    );
  }

  const movement = await prisma.stockMovement.findUnique({
    where: { id: movementId },
    select: { id: true },
  });
  if (!movement) throw new NotFoundError(`Stock movement '${movementId}' not found`);

  const row = await prisma.restockRequest.update({
    where: { id },
    data: {
      status: RestockStatus.FULFILLED,
      fulfilledAt: new Date(),
      fulfillmentMovementId: movementId,
    },
    select: restockSelect,
  });

  return toRestock(row);
};
