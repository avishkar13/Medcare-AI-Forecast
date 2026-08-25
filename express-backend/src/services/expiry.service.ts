import { prisma } from "../config/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { NotFoundError } from "../utils/errors.js";
import { expirySeverity, round } from "../utils/inventory.js";
import type { ExpiryBatchQuery, ExpiryQuery } from "../zod/expiry.schemas.js";

/**
 * Shelf-life exposure, read from `InventoryBatch`.
 *
 * Risk bands come from `expirySeverity` in `utils/inventory.ts` - the same function
 * `/api/dashboard/expiry-risk` uses - so the two surfaces can never disagree about
 * whether a batch is critical.
 */

const MS_PER_DAY = 86_400_000;
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

const daysToExpiry = (expiryDate: Date, now: number) =>
  Math.floor((expiryDate.getTime() - now) / MS_PER_DAY);

const resolveWarehouse = async (warehouse: string) => {
  const row = await prisma.warehouse.findFirst({
    where: { OR: [{ id: warehouse }, { code: warehouse }] },
    select: { id: true },
  });
  if (!row) throw new NotFoundError(`Warehouse '${warehouse}' not found`);
  return row.id;
};

const resolveProduct = async (sku: string) => {
  const product = await prisma.product.findFirst({
    where: { OR: [{ id: sku }, { sku }] },
    select: { id: true },
  });
  if (!product) throw new NotFoundError(`Product '${sku}' not found`);
  return product.id;
};

const whereOf = async (query: ExpiryQuery): Promise<Prisma.InventoryBatchWhereInput> => {
  const [productId, warehouseId] = await Promise.all([
    query.sku === undefined ? undefined : resolveProduct(query.sku),
    query.warehouse === undefined ? undefined : resolveWarehouse(query.warehouse),
  ]);

  return {
    // Expired stock is not shelf-life *risk*; it is already a write-off, and mixing
    // the two would inflate every exposure figure on the page.
    expiryDate: {
      gte: new Date(),
      ...(query.withinDays === undefined
        ? {}
        : { lte: new Date(Date.now() + query.withinDays * MS_PER_DAY) }),
    },
    ...(productId === undefined ? {} : { productId }),
    ...(warehouseId === undefined ? {} : { warehouseId }),
  };
};

const batchSelect = {
  id: true,
  batchNumber: true,
  quantity: true,
  manufacturingDate: true,
  expiryDate: true,
  productId: true,
  warehouseId: true,
  product: { select: { sku: true, name: true, unitCost: true, criticality: true } },
  warehouse: { select: { code: true, name: true, tier: true } },
} satisfies Prisma.InventoryBatchSelect;

type BatchRow = Prisma.InventoryBatchGetPayload<{ select: typeof batchSelect }>;

const toBatch = (row: BatchRow, now: number) => {
  const days = daysToExpiry(row.expiryDate, now);
  // One number, one name. The route this replaces reported the same figure three
  // times as valueAtRisk, wasteValue and inventoryValue.
  const value = round(row.quantity * Number(row.product.unitCost));

  return {
    id: row.id,
    batchNumber: row.batchNumber,
    productId: row.productId,
    sku: row.product.sku,
    productName: row.product.name,
    criticality: row.product.criticality,
    warehouseId: row.warehouseId,
    warehouseCode: row.warehouse.code,
    warehouseName: row.warehouse.name,
    tier: row.warehouse.tier,
    quantity: row.quantity,
    unitCost: Number(row.product.unitCost),
    inventoryValue: value,
    manufacturingDate: row.manufacturingDate ? isoDay(row.manufacturingDate) : null,
    expiryDate: isoDay(row.expiryDate),
    daysRemaining: days,
    riskLevel: expirySeverity(days),
  };
};

export const listBatches = async (query: ExpiryBatchQuery) => {
  const where = await whereOf(query);

  const [total, rows] = await Promise.all([
    prisma.inventoryBatch.count({ where }),
    prisma.inventoryBatch.findMany({
      where,
      select: batchSelect,
      // Soonest first: the batches a planner can still do something about.
      orderBy: { expiryDate: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  const now = Date.now();
  const items = rows.map((row) => toBatch(row, now));

  return {
    items: query.risk === undefined ? items : items.filter((item) => item.riskLevel === query.risk),
    total,
  };
};

export const getOverview = async (query: ExpiryQuery) => {
  const where = await whereOf(query);

  const [rows, prevented] = await Promise.all([
    prisma.inventoryBatch.findMany({
      where,
      select: { quantity: true, expiryDate: true, product: { select: { unitCost: true } } },
    }),
    prisma.wastePreventionRecord.aggregate({ _sum: { valueSaved: true, unitsSaved: true } }),
  ]);

  const now = Date.now();
  let totalValue = 0;
  let criticalValue = 0;
  let criticalBatches = 0;
  let dayTotal = 0;

  for (const row of rows) {
    const days = daysToExpiry(row.expiryDate, now);
    const value = row.quantity * Number(row.product.unitCost);
    totalValue += value;
    dayTotal += days;
    if (expirySeverity(days) === "critical") {
      criticalValue += value;
      criticalBatches += 1;
    }
  }

  return {
    batchesTracked: rows.length,
    totalAtRiskValue: round(totalValue),
    criticalBatches,
    criticalAtRiskValue: round(criticalValue),
    averageDaysToExpiry: rows.length === 0 ? null : round(dayTotal / rows.length),
    // From WastePreventionRecord. Null rather than 0 when nothing is recorded, so
    // "no programme yet" reads differently from "the programme saved nothing".
    preventedWasteValue:
      prevented._sum.valueSaved === null ? null : round(prevented._sum.valueSaved),
    preventedWasteUnits:
      prevented._sum.unitsSaved === null ? null : round(prevented._sum.unitsSaved),
  };
};

/** Value expiring per calendar month, soonest first. */
export const getTimeline = async (query: ExpiryQuery) => {
  const where = await whereOf(query);
  const rows = await prisma.inventoryBatch.findMany({
    where,
    select: { quantity: true, expiryDate: true, product: { select: { unitCost: true } } },
    orderBy: { expiryDate: "asc" },
  });

  const buckets = new Map<string, { valueExpiring: number; batchCount: number; units: number }>();

  for (const row of rows) {
    const month = isoDay(row.expiryDate).slice(0, 7);
    const bucket = buckets.get(month) ?? { valueExpiring: 0, batchCount: 0, units: 0 };
    bucket.valueExpiring += row.quantity * Number(row.product.unitCost);
    bucket.units += row.quantity;
    bucket.batchCount += 1;
    buckets.set(month, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, bucket]) => ({
      month,
      valueExpiring: round(bucket.valueExpiring),
      units: round(bucket.units),
      batchCount: bucket.batchCount,
    }));
};

export const getDcExposure = async (query: ExpiryQuery) => {
  const where = await whereOf(query);

  const [rows, warehouses] = await Promise.all([
    prisma.inventoryBatch.findMany({
      where,
      select: {
        warehouseId: true,
        quantity: true,
        expiryDate: true,
        product: { select: { unitCost: true } },
      },
    }),
    prisma.warehouse.findMany({ select: { id: true, code: true, name: true, tier: true, region: true } }),
  ]);

  const now = Date.now();
  const totals = new Map<string, { total: number; critical: number; batches: number }>();

  for (const row of rows) {
    const bucket = totals.get(row.warehouseId) ?? { total: 0, critical: 0, batches: 0 };
    const value = row.quantity * Number(row.product.unitCost);
    bucket.total += value;
    bucket.batches += 1;
    if (expirySeverity(daysToExpiry(row.expiryDate, now)) === "critical") bucket.critical += value;
    totals.set(row.warehouseId, bucket);
  }

  return warehouses
    .map((warehouse) => {
      const bucket = totals.get(warehouse.id) ?? { total: 0, critical: 0, batches: 0 };
      return {
        warehouseId: warehouse.id,
        code: warehouse.code,
        name: warehouse.name,
        tier: warehouse.tier,
        region: warehouse.region,
        batchCount: bucket.batches,
        totalExposureValue: round(bucket.total),
        criticalExposureValue: round(bucket.critical),
      };
    })
    .sort((a, b) => b.totalExposureValue - a.totalExposureValue);
};

export const listWastePrevention = async () => {
  const rows = await prisma.wastePreventionRecord.findMany({
    orderBy: { date: "desc" },
    take: 100,
  });

  const totals = rows.reduce(
    (sum, row) => ({ units: sum.units + row.unitsSaved, value: sum.value + row.valueSaved }),
    { units: 0, value: 0 },
  );

  return {
    items: rows.map((row) => ({
      id: row.id,
      productName: row.productName,
      actionTaken: row.actionTaken,
      unitsSaved: row.unitsSaved,
      valueSaved: row.valueSaved,
      date: isoDay(row.date),
    })),
    totalUnitsSaved: round(totals.units),
    totalValueSaved: round(totals.value),
  };
};

/**
 * What is worth acting on, and why - derived, not written.
 *
 * The route this replaces returned a fixed sentence naming a warehouse and a product
 * that had nothing to do with the data.
 */
export const getAssessment = async (query: ExpiryQuery) => {
  const [overview, exposure, timeline] = await Promise.all([
    getOverview(query),
    getDcExposure(query),
    getTimeline(query),
  ]);

  const worst = exposure[0];
  const soonest = timeline[0];
  const findings: { kind: string; detail: string }[] = [];

  if (overview.batchesTracked === 0) {
    return { ...overview, findings: [{ kind: "coverage", detail: "No unexpired batches are tracked" }] };
  }

  findings.push({
    kind: "exposure",
    detail: `${overview.criticalBatches} of ${overview.batchesTracked} batches are critical, carrying ${overview.criticalAtRiskValue} of ${overview.totalAtRiskValue} at risk`,
  });

  if (worst && worst.totalExposureValue > 0) {
    findings.push({
      kind: "location",
      detail: `${worst.name} holds the largest exposure at ${worst.totalExposureValue}, of which ${worst.criticalExposureValue} is critical`,
    });
  }

  if (soonest) {
    findings.push({
      kind: "timing",
      detail: `${soonest.valueExpiring} expires in ${soonest.month} across ${soonest.batchCount} batches`,
    });
  }

  return { ...overview, findings };
};
