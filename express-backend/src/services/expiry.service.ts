import { prisma } from "../config/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { NotFoundError } from "../utils/errors.js";
import { expirySeverity, percentage, projectFefoWaste, round } from "../utils/inventory.js";
import { loadPositions } from "./dashboard.service.js";
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
const pairKey = (productId: string, warehouseId: string) => `${productId}:${warehouseId}`;

/** The windows every expiry surface buckets by, so no caller invents its own. */
const EXPIRY_WINDOWS = [
  { label: "0-30 Days", fromDays: 0, toDays: 30 },
  { label: "31-60 Days", fromDays: 31, toDays: 60 },
  { label: "61-90 Days", fromDays: 61, toDays: 90 },
  { label: "90+ Days", fromDays: 91, toDays: null },
] as const;

const RISK_LEVELS = ["critical", "high", "medium", "low"] as const;

const loadDemandByPair = async () => {
  const positions = await loadPositions();
  return new Map(
    positions.map((position) => [
      pairKey(position.productId, position.warehouseId),
      position.avgDailyDemand,
    ]),
  );
};

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

const whereOf = async (query: ExpiryQuery, authScope?: { warehouseId?: string | null }): Promise<Prisma.InventoryBatchWhereInput> => {
  const effectiveWarehouse = query.warehouse ?? authScope?.warehouseId;
  const [productId, warehouseId] = await Promise.all([
    query.sku === undefined ? undefined : resolveProduct(query.sku),
    effectiveWarehouse === undefined || effectiveWarehouse === null ? undefined : resolveWarehouse(effectiveWarehouse),
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

/**
 * Projected waste per batch, allocated FEFO within each product/warehouse pair.
 *
 * A batch is only consumable by the demand that arrives before *it* expires, and
 * earlier batches are drawn down first, so the answer depends on the whole pair, not
 * on the batch alone. Computed once here rather than modelled by every caller.
 */
const projectPairWaste = async (where: Prisma.InventoryBatchWhereInput, now: number) => {
  const [rows, demandByPair] = await Promise.all([
    prisma.inventoryBatch.findMany({
      where,
      select: { id: true, productId: true, warehouseId: true, quantity: true, expiryDate: true },
      orderBy: { expiryDate: "asc" },
    }),
    loadDemandByPair(),
  ]);

  const byPair = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = pairKey(row.productId, row.warehouseId);
    byPair.set(key, [...(byPair.get(key) ?? []), row]);
  }

  const waste = new Map<string, { avgDailyDemand: number; wasteUnits: number }>();

  for (const [key, batches] of byPair) {
    const avgDailyDemand = demandByPair.get(key) ?? 0;
    const projected = projectFefoWaste(
      batches.map((batch) => ({
        quantity: batch.quantity,
        daysToExpiry: daysToExpiry(batch.expiryDate, now),
      })),
      avgDailyDemand,
    );

    batches.forEach((batch, index) => {
      waste.set(batch.id, { avgDailyDemand, wasteUnits: projected[index] ?? 0 });
    });
  }

  return waste;
};

export const listBatches = async (query: ExpiryBatchQuery, authScope?: { warehouseId?: string | null }) => {
  const where = await whereOf(query, authScope);
  const now = Date.now();

  const [total, rows, waste] = await Promise.all([
    prisma.inventoryBatch.count({ where }),
    prisma.inventoryBatch.findMany({
      where,
      select: batchSelect,
      // Soonest first: the batches a planner can still do something about.
      orderBy: { expiryDate: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    projectPairWaste(where, now),
  ]);

  const items = rows.map((row) => {
    const base = toBatch(row, now);
    const projected = waste.get(row.id) ?? { avgDailyDemand: 0, wasteUnits: 0 };
    const forecastDemand = round(projected.avgDailyDemand * Math.max(0, base.daysRemaining));
    const wasteUnits = round(projected.wasteUnits);

    return {
      ...base,
      avgDailyDemand: round(projected.avgDailyDemand),
      forecastDemand,
      projectedWasteUnits: wasteUnits,
      projectedWasteValue: round(wasteUnits * base.unitCost),
      demandCoveragePercent: percentage(base.quantity - wasteUnits, base.quantity),
      projectedWasteSharePercent: percentage(wasteUnits, base.quantity),
    };
  });

  return {
    items: query.risk === undefined ? items : items.filter((item) => item.riskLevel === query.risk),
    total,
  };
};

export const getOverview = async (query: ExpiryQuery, authScope?: { warehouseId?: string | null }) => {
  const where = await whereOf(query, authScope);

  const [rows, prevented] = await Promise.all([
    prisma.inventoryBatch.findMany({
      where,
      select: { quantity: true, expiryDate: true, product: { select: { unitCost: true } } },
    }),
    prisma.wastePreventionRecord.aggregate({ _sum: { valueSaved: true, unitsSaved: true } }),
  ]);

  const now = Date.now();
  let totalValue = 0;
  let totalUnits = 0;
  let criticalValue = 0;
  let criticalBatches = 0;
  let dayTotal = 0;

  for (const row of rows) {
    const days = daysToExpiry(row.expiryDate, now);
    const value = row.quantity * Number(row.product.unitCost);
    totalValue += value;
    totalUnits += row.quantity;
    dayTotal += days;
    if (expirySeverity(days) === "critical") {
      criticalValue += value;
      criticalBatches += 1;
    }
  }

  return {
    batchesTracked: rows.length,
    unitsAtRisk: round(totalUnits),
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
export const getTimeline = async (query: ExpiryQuery, authScope?: { warehouseId?: string | null }) => {
  const where = await whereOf(query, authScope);
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

/**
 * The same batch set cut two ways: by time-to-expiry window and by risk band.
 *
 * Both cuts used to be done in the browser from a page of raw batches, which was
 * wrong as soon as the network held more batches than one page.
 */
export const getExposure = async (query: ExpiryQuery, authScope?: { warehouseId?: string | null }) => {
  const where = await whereOf(query, authScope);
  const rows = await prisma.inventoryBatch.findMany({
    where,
    select: { quantity: true, expiryDate: true, product: { select: { unitCost: true } } },
  });

  const now = Date.now();
  const windows = EXPIRY_WINDOWS.map((window) => ({ ...window, value: 0, units: 0, batchCount: 0 }));
  const risks = RISK_LEVELS.map((level) => ({ level, value: 0, units: 0, batchCount: 0 }));

  let totalValue = 0;
  let totalUnits = 0;

  for (const row of rows) {
    const days = daysToExpiry(row.expiryDate, now);
    const value = row.quantity * Number(row.product.unitCost);
    totalValue += value;
    totalUnits += row.quantity;

    const window = windows.find(
      (candidate) => days >= candidate.fromDays && (candidate.toDays === null || days <= candidate.toDays),
    );
    if (window) {
      window.value += value;
      window.units += row.quantity;
      window.batchCount += 1;
    }

    const risk = risks.find((candidate) => candidate.level === expirySeverity(days));
    if (risk) {
      risk.value += value;
      risk.units += row.quantity;
      risk.batchCount += 1;
    }
  }

  return {
    totalExposureValue: round(totalValue),
    totalUnits: round(totalUnits),
    byWindow: windows.map((window) => ({
      label: window.label,
      fromDays: window.fromDays,
      toDays: window.toDays,
      value: round(window.value),
      units: round(window.units),
      batchCount: window.batchCount,
      sharePercent: percentage(window.value, totalValue),
    })),
    byRisk: risks.map((risk) => ({
      level: risk.level,
      value: round(risk.value),
      units: round(risk.units),
      batchCount: risk.batchCount,
      sharePercent: percentage(risk.value, totalValue),
    })),
  };
};

/**
 * Can demand consume the stock before it expires?
 *
 * Network roll-up of the same FEFO projection `listBatches` reports per batch, so
 * the headline and the table can never disagree.
 */
export const getDemandCoverage = async (query: ExpiryQuery, authScope?: { warehouseId?: string | null }) => {
  const where = await whereOf(query, authScope);
  const now = Date.now();

  const [rows, waste] = await Promise.all([
    prisma.inventoryBatch.findMany({
      where,
      select: {
        id: true,
        quantity: true,
        expiryDate: true,
        product: { select: { unitCost: true } },
      },
    }),
    projectPairWaste(where, now),
  ]);

  let units = 0;
  let unusedUnits = 0;
  let valueAtRisk = 0;
  let wasteValue = 0;
  let soonestExpiryDays: number | null = null;

  for (const row of rows) {
    const unitCost = Number(row.product.unitCost);
    const unused = waste.get(row.id)?.wasteUnits ?? 0;
    const days = daysToExpiry(row.expiryDate, now);

    units += row.quantity;
    unusedUnits += unused;
    valueAtRisk += row.quantity * unitCost;
    wasteValue += unused * unitCost;
    soonestExpiryDays = soonestExpiryDays === null ? days : Math.min(soonestExpiryDays, days);
  }

  const consumableUnits = units - unusedUnits;

  return {
    batchesTracked: rows.length,
    unitsExpiring: round(units),
    consumableUnits: round(consumableUnits),
    unusedUnits: round(unusedUnits),
    utilizationPercent: percentage(consumableUnits, units),
    wastedSharePercent: percentage(unusedUnits, units),
    valueAtRisk: round(valueAtRisk),
    projectedWasteValue: round(wasteValue),
    soonestExpiryDays,
  };
};

export const getDcExposure = async (query: ExpiryQuery, authScope?: { warehouseId?: string | null }) => {
  const where = await whereOf(query, authScope);

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

  const byAction = new Map<string, { unitsSaved: number; valueSaved: number; count: number }>();
  for (const row of rows) {
    const bucket = byAction.get(row.actionTaken) ?? { unitsSaved: 0, valueSaved: 0, count: 0 };
    bucket.unitsSaved += row.unitsSaved;
    bucket.valueSaved += row.valueSaved;
    bucket.count += 1;
    byAction.set(row.actionTaken, bucket);
  }

  return {
    items: rows.map((row) => ({
      id: row.id,
      productName: row.productName,
      actionTaken: row.actionTaken,
      unitsSaved: row.unitsSaved,
      valueSaved: row.valueSaved,
      date: isoDay(row.date),
    })),
    byAction: [...byAction.entries()]
      .map(([actionTaken, bucket]) => ({
        actionTaken,
        recordCount: bucket.count,
        unitsSaved: round(bucket.unitsSaved),
        valueSaved: round(bucket.valueSaved),
        sharePercent: percentage(bucket.valueSaved, totals.value),
      }))
      .sort((a, b) => b.valueSaved - a.valueSaved),
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
export const getAssessment = async (query: ExpiryQuery, authScope?: { warehouseId?: string | null }) => {
  const [overview, exposure, timeline] = await Promise.all([
    getOverview(query, authScope),
    getDcExposure(query, authScope),
    getTimeline(query, authScope),
  ]);

  const worst = exposure[0];
  const soonest = timeline[0];
  const findings: { kind: string; detail: string }[] = [];

  // Graded from how much of the value at risk sits in critical batches. Here rather
  // than in the client, so every surface grades it the same way.
  const criticalShare = percentage(overview.criticalAtRiskValue, overview.totalAtRiskValue);
  const riskLevel =
    overview.criticalBatches === 0
      ? "low"
      : criticalShare >= 25
        ? "high"
        : criticalShare >= 10
          ? "moderate"
          : "low";

  if (overview.batchesTracked === 0) {
    return {
      ...overview,
      riskLevel: "low" as const,
      criticalSharePercent: 0,
      findings: [{ kind: "coverage", detail: "No unexpired batches are tracked" }],
    };
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

  return { ...overview, riskLevel, criticalSharePercent: criticalShare, findings };
};
