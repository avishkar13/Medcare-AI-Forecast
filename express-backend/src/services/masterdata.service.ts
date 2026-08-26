import { prisma } from "../config/prisma.js";
import type { Prisma, Product, Warehouse } from "../../generated/prisma/client.js";
import { NotFoundError } from "../utils/errors.js";
import { round } from "../utils/inventory.js";
import type {
  DistributorQuery,
  ProductQuery,
  ProductParams,
  PromotionQuery,
  WarehouseParams,
  WarehouseQuery,
} from "../zod/masterdata.schemas.js";
import type { ProductSummary, WarehouseSummary } from "../types.js";

const toProductSummary = (product: Product): ProductSummary => ({
  id: product.id,
  sku: product.sku,
  name: product.name,
  category: product.category,
  unit: product.unit,
  unitCost: Number(product.unitCost),
  shelfLifeDays: product.shelfLifeDays,
  criticality: product.criticality,
  isActive: product.isActive,
});

const toWarehouseSummary = (warehouse: Warehouse): WarehouseSummary => ({
  id: warehouse.id,
  code: warehouse.code,
  name: warehouse.name,
  region: warehouse.region,
  tier: warehouse.tier,
  location: warehouse.location,
  capacity: warehouse.capacity,
  isActive: warehouse.isActive,
});

export const listProducts = async (
  query: ProductQuery,
): Promise<{ items: ProductSummary[]; total: number }> => {
  const where: Prisma.ProductWhereInput = {
    ...(query.search === undefined
      ? {}
      : {
          OR: [
            { sku: { contains: query.search, mode: "insensitive" } },
            { name: { contains: query.search, mode: "insensitive" } },
          ],
        }),
    ...(query.category === undefined ? {} : { category: query.category }),
    ...(query.criticality === undefined ? {} : { criticality: query.criticality }),
    ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
  };

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { sku: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return { items: rows.map(toProductSummary), total };
};

export const getProduct = async ({ id }: ProductParams): Promise<ProductSummary> => {
  const product = await prisma.product.findFirst({ where: { OR: [{ id }, { sku: id }] } });
  if (!product) throw new NotFoundError(`Product '${id}' not found`);
  return toProductSummary(product);
};

export const listWarehouses = async (query: WarehouseQuery): Promise<WarehouseSummary[]> => {
  const rows = await prisma.warehouse.findMany({
    where: {
      ...(query.tier === undefined ? {} : { tier: query.tier }),
      ...(query.region === undefined ? {} : { region: query.region }),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
    },
    orderBy: { code: "asc" },
  });

  return rows.map(toWarehouseSummary);
};

/**
 * One warehouse, with what it currently holds.
 *
 * The list route answers "which DCs exist"; this answers "what is going on at this
 * one", which is the question a drill-down actually asks. The counts come from
 * aggregates rather than from loading positions, so the response size does not grow
 * with the network.
 */
export const getWarehouse = async ({ id }: WarehouseParams) => {
  const row = await prisma.warehouse.findFirst({
    where: { OR: [{ id }, { code: id }] },
  });
  if (!row) throw new NotFoundError(`Warehouse '${id}' not found`);

  const [positions, batches, distributors] = await Promise.all([
    prisma.inventory.aggregate({
      where: { warehouseId: row.id },
      _count: true,
      _sum: { onHand: true, reserved: true, inTransit: true },
    }),
    prisma.inventoryBatch.count({
      where: { warehouseId: row.id, expiryDate: { gte: new Date() } },
    }),
    prisma.distributor.count({ where: { warehouseId: row.id, isActive: true } }),
  ]);

  return {
    ...toWarehouseSummary(row),
    positions: positions._count,
    onHand: round(positions._sum.onHand ?? 0),
    reserved: round(positions._sum.reserved ?? 0),
    inTransit: round(positions._sum.inTransit ?? 0),
    unexpiredBatches: batches,
    activeDistributors: distributors,
  };
};

export const listDistributors = async (query: DistributorQuery) => {
  const warehouseId =
    query.warehouse === undefined
      ? undefined
      : (
          await prisma.warehouse.findFirst({
            where: { OR: [{ id: query.warehouse }, { code: query.warehouse }] },
            select: { id: true },
          })
        )?.id;

  if (query.warehouse !== undefined && warehouseId === undefined) {
    throw new NotFoundError(`Warehouse '${query.warehouse}' not found`);
  }

  const rows = await prisma.distributor.findMany({
    where: {
      ...(warehouseId === undefined ? {} : { warehouseId }),
      ...(query.region === undefined ? {} : { region: query.region }),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
    },
    orderBy: { code: "asc" },
    include: { warehouse: { select: { code: true, name: true } }, _count: { select: { orders: true } } },
  });

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    region: row.region,
    isActive: row.isActive,
    warehouseId: row.warehouseId,
    warehouseCode: row.warehouse?.code ?? null,
    warehouseName: row.warehouse?.name ?? null,
    orderCount: row._count.orders,
  }));
};

/**
 * Promotions, past and upcoming.
 *
 * `upcoming` uses `endDate >= today` rather than `startDate > now`, so a promotion
 * running right now counts as upcoming - it is still affecting demand. The same rule
 * the training export uses.
 */
export const listPromotions = async (query: PromotionQuery) => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const where = {
    ...(query.upcoming === undefined
      ? {}
      : query.upcoming
        ? { endDate: { gte: today } }
        : { endDate: { lt: today } }),
  };

  const [total, rows] = await Promise.all([
    prisma.promotionEvent.count({ where }),
    prisma.promotionEvent.findMany({
      where,
      orderBy: { startDate: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        product: { select: { sku: true, name: true } },
        warehouse: { select: { code: true, name: true } },
      },
    }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      startDate: row.startDate.toISOString().slice(0, 10),
      endDate: row.endDate.toISOString().slice(0, 10),
      upliftFactor: row.upliftFactor,
      // Null on either means the promotion applies network-wide or to every product.
      productId: row.productId,
      sku: row.product?.sku ?? null,
      productName: row.product?.name ?? null,
      warehouseId: row.warehouseId,
      warehouseCode: row.warehouse?.code ?? null,
      scope:
        row.productId && row.warehouseId
          ? "product-warehouse"
          : row.productId
            ? "product"
            : row.warehouseId
              ? "warehouse"
              : "network",
    })),
    total,
  };
};
