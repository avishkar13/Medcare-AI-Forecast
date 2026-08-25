import { prisma } from "../config/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { NotFoundError } from "../utils/errors.js";
import type { TrainingDataQuery } from "../zod/training.schemas.js";
import type { TrainingRow } from "../types.js";

const BATCH_SIZE = 10_000;

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

const whereOf = (query: TrainingDataQuery): Prisma.DemandHistoryWhereInput => ({
  ...(query.from === undefined && query.to === undefined
    ? {}
    : {
        date: {
          ...(query.from === undefined ? {} : { gte: query.from }),
          ...(query.to === undefined ? {} : { lte: query.to }),
        },
      }),
  ...(query.sku === undefined ? {} : { product: { OR: [{ id: query.sku }, { sku: query.sku }] } }),
  ...(query.warehouse === undefined
    ? {}
    : { warehouse: { OR: [{ id: query.warehouse }, { code: query.warehouse }] } }),
});

const selection = {
  date: true,
  orderedQuantity: true,
  fulfilledQuantity: true,
  stockoutFlag: true,
  promotionFlag: true,
  holidayFlag: true,
  season: true,
  productId: true,
  warehouseId: true,
  product: { select: { sku: true } },
  warehouse: { select: { code: true } },
} satisfies Prisma.DemandHistorySelect;

type SelectedRow = Prisma.DemandHistoryGetPayload<{ select: typeof selection }>;

const toTrainingRow = (row: SelectedRow): TrainingRow => ({
  date: isoDay(row.date),
  sku: row.product.sku,
  productId: row.productId,
  dc: row.warehouse.code,
  warehouseId: row.warehouseId,
  demand: row.orderedQuantity,
  fulfilled: row.fulfilledQuantity,
  stockout: row.stockoutFlag,
  promotion: row.promotionFlag,
  holiday: row.holidayFlag,
  season: row.season,
});

const assertFiltersMatch = async (query: TrainingDataQuery): Promise<void> => {
  if (query.sku !== undefined) {
    const product = await prisma.product.findFirst({
      where: { OR: [{ id: query.sku }, { sku: query.sku }] },
      select: { id: true },
    });
    if (!product) throw new NotFoundError(`Product '${query.sku}' not found`);
  }

  if (query.warehouse !== undefined) {
    const warehouse = await prisma.warehouse.findFirst({
      where: { OR: [{ id: query.warehouse }, { code: query.warehouse }] },
      select: { id: true },
    });
    if (!warehouse) throw new NotFoundError(`Warehouse '${query.warehouse}' not found`);
  }
};

export const countTrainingRows = async (query: TrainingDataQuery): Promise<number> => {
  await assertFiltersMatch(query);
  return prisma.demandHistory.count({ where: whereOf(query) });
};

export async function* streamTrainingRows(query: TrainingDataQuery): AsyncGenerator<TrainingRow> {
  const where = whereOf(query);
  let cursor: Prisma.DemandHistoryWhereUniqueInput | undefined;

  for (;;) {
    const rows = await prisma.demandHistory.findMany({
      where,
      select: selection,
      orderBy: [{ productId: "asc" }, { warehouseId: "asc" }, { date: "asc" }],
      take: BATCH_SIZE,
      ...(cursor === undefined ? {} : { cursor, skip: 1 }),
    });

    for (const row of rows) yield toTrainingRow(row);
    if (rows.length < BATCH_SIZE) return;

    const last = rows[rows.length - 1]!;
    cursor = {
      productId_warehouseId_date: {
        productId: last.productId,
        warehouseId: last.warehouseId,
        date: last.date,
      },
    };
  }
}
