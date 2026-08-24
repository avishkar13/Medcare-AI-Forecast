import { prisma } from "../config/prisma.js";
import type { Prisma, Product, Warehouse } from "../../generated/prisma/client.js";
import { NotFoundError } from "../utils/errors.js";
import type { ProductQuery, ProductParams, WarehouseQuery } from "../zod/masterdata.schemas.js";
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
