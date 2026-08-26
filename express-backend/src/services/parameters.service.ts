import { prisma } from "../config/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { NotFoundError } from "../utils/errors.js";
import type {
  ParametersQuery,
  UpsertParametersBody,
} from "../zod/parameters.schemas.js";

/**
 * The numbers the executor plans with.
 *
 * `PlanningParameter` carried every one of these from the first migration and no
 * route touched any of them: the engine planned with values a planner could neither
 * see nor change. `reviewPeriodDays` in particular is the brief's review cadence.
 *
 * Changing `serviceLevel` here changes the z-score in `safetyStock()` on the next
 * run - there is a test that proves the value reaches the executor rather than
 * merely being stored.
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

const parameterSelect = {
  id: true,
  productId: true,
  warehouseId: true,
  leadTimeDays: true,
  leadTimeStdDev: true,
  serviceLevel: true,
  reviewPeriodDays: true,
  minimumOrderQty: true,
  maximumInventory: true,
  holdingCostPerUnit: true,
  stockoutCostPerUnit: true,
  expiryCostPerUnit: true,
  product: { select: { sku: true, name: true, criticality: true } },
  warehouse: { select: { code: true, name: true, tier: true } },
} satisfies Prisma.PlanningParameterSelect;

type ParameterRow = Prisma.PlanningParameterGetPayload<{ select: typeof parameterSelect }>;

const toParameter = (row: ParameterRow) => ({
  id: row.id,
  productId: row.productId,
  sku: row.product.sku,
  productName: row.product.name,
  criticality: row.product.criticality,
  warehouseId: row.warehouseId,
  warehouseCode: row.warehouse.code,
  warehouseName: row.warehouse.name,
  tier: row.warehouse.tier,
  leadTimeDays: row.leadTimeDays,
  leadTimeStdDev: row.leadTimeStdDev,
  serviceLevel: row.serviceLevel,
  reviewPeriodDays: row.reviewPeriodDays,
  minimumOrderQty: row.minimumOrderQty,
  maximumInventory: row.maximumInventory,
  holdingCostPerUnit: row.holdingCostPerUnit,
  stockoutCostPerUnit: row.stockoutCostPerUnit,
  expiryCostPerUnit: row.expiryCostPerUnit,
});

export const listParameters = async (query: ParametersQuery) => {
  const [productId, warehouseId] = await Promise.all([
    query.sku === undefined ? undefined : resolveProduct(query.sku),
    query.warehouse === undefined ? undefined : resolveWarehouse(query.warehouse),
  ]);

  const where: Prisma.PlanningParameterWhereInput = {
    ...(productId === undefined ? {} : { productId }),
    ...(warehouseId === undefined ? {} : { warehouseId }),
  };

  const [total, rows] = await Promise.all([
    prisma.planningParameter.count({ where }),
    prisma.planningParameter.findMany({
      where,
      select: parameterSelect,
      orderBy: [{ product: { sku: "asc" } }, { warehouse: { code: "asc" } }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return { items: rows.map(toParameter), total };
};

/**
 * Upserts on the existing `@@unique([productId, warehouseId])`.
 *
 * `PUT` rather than `PATCH`: every planning value is sent together. A partial update
 * would let a caller raise `serviceLevel` while leaving a stale `leadTimeDays`
 * beside it, and the two are read as a pair when safety stock is computed.
 */
export const upsertParameters = async (body: UpsertParametersBody) => {
  const [productId, warehouseId] = await Promise.all([
    resolveProduct(body.sku),
    resolveWarehouse(body.warehouse),
  ]);

  const values = {
    leadTimeDays: body.leadTimeDays,
    leadTimeStdDev: body.leadTimeStdDev,
    serviceLevel: body.serviceLevel,
    reviewPeriodDays: body.reviewPeriodDays,
    minimumOrderQty: body.minimumOrderQty,
    maximumInventory: body.maximumInventory,
    holdingCostPerUnit: body.holdingCostPerUnit,
    stockoutCostPerUnit: body.stockoutCostPerUnit,
    expiryCostPerUnit: body.expiryCostPerUnit,
  };

  const row = await prisma.planningParameter.upsert({
    where: { productId_warehouseId: { productId, warehouseId } },
    create: { productId, warehouseId, ...values },
    update: values,
    select: parameterSelect,
  });

  return toParameter(row);
};

export const getParameters = async (sku: string, warehouse: string) => {
  const [productId, warehouseId] = await Promise.all([
    resolveProduct(sku),
    resolveWarehouse(warehouse),
  ]);

  const row = await prisma.planningParameter.findUnique({
    where: { productId_warehouseId: { productId, warehouseId } },
    select: parameterSelect,
  });

  if (!row) {
    throw new NotFoundError(`No planning parameters for '${sku}' at '${warehouse}'`);
  }
  return toParameter(row);
};
