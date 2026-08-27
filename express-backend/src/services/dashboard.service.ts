import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { currentAccuracyPercent } from "./forecast-accuracy.service.js";
import {
  classifyStock,
  percentage,
  projectFefoWaste,
  reorderPoint,
  round,
  safetyStock,
} from "../utils/inventory.js";
import { planTransfers } from "../utils/allocation.js";
import { NotFoundError } from "../utils/errors.js";
import type {
  ExpiryRiskQuery,
  InventoryHealthQuery,
  NetworkQuery,
  PriorityActionsQuery,
} from "../zod/dashboard.schemas.js";
import type {
  CategoryHealth,
  CriticalityHealth,
  DashboardKPIs,
  ExpiryRiskItem,
  ExpiryRiskReport,
  InventoryHealthReport,
  InventoryHealthState,
  NetworkHealthSummary,
  PriorityAction,
  PriorityActionType,
  PriorityActionsReport,
  RiskLevel,
  WarehouseStats,
} from "../types.js";

const DEMAND_WINDOW_DAYS = 90;
const EXPIRY_HORIZON_DAYS = 90;
const CRITICAL_EXPIRY_DAYS = 30;
const CRITICALITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const UNCATEGORIZED = "Uncategorized";
const SEVERITY_CRITICAL_DAYS = 15;
const SEVERITY_HIGH_DAYS = 30;
const SEVERITY_MEDIUM_DAYS = 60;

const severityOf = (daysToExpiry: number): RiskLevel => {
  if (daysToExpiry <= SEVERITY_CRITICAL_DAYS) return "critical";
  if (daysToExpiry <= SEVERITY_HIGH_DAYS) return "high";
  if (daysToExpiry <= SEVERITY_MEDIUM_DAYS) return "medium";
  return "low";
};

export interface InventoryPosition {
  productId: string;
  warehouseId: string;
  sku: string;
  productName: string;
  category: string | null;
  unitCost: number;
  criticality: string;
  warehouseCode: string;
  warehouseName: string;
  warehouseTier: string;
  warehouseCapacity: number | null;
  onHand: number;
  reserved: number;
  inTransit: number;
  avgDailyDemand: number;
  leadTimeDays: number;
  safetyStock: number;
  reorderPoint: number;
  maximumInventory: number | null;
  stockoutCostPerUnit: number;
  daysOfSupply: number;
  inventoryValue: number;
}

export interface ExpiringBatch {
  productId: string;
  warehouseId: string;
  quantity: number;
  value: number;
  daysToExpiry: number;
}

interface DemandStat {
  productId: string;
  warehouseId: string;
  avgDaily: number;
  stdDev: number;
}

const horizon = (days: number) => new Date(Date.now() + days * 86_400_000);
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);
const daysUntil = (date: Date) => Math.ceil((date.getTime() - Date.now()) / 86_400_000);
const pairKey = (productId: string, warehouseId: string) => `${productId}:${warehouseId}`;

const sumBy = <T>(rows: T[], value: (row: T) => number): number =>
  rows.reduce((total, row) => total + value(row), 0);

const groupBy = <T>(rows: T[], key: (row: T) => string): Map<string, T[]> => {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const id = key(row);
    const bucket = groups.get(id);
    if (bucket) bucket.push(row);
    else groups.set(id, [row]);
  }
  return groups;
};

export const loadPositions = async (scope?: { warehouseId?: string | null }): Promise<InventoryPosition[]> => {
  const warehouseCondition = scope?.warehouseId ? Prisma.sql`AND "warehouseId" = ${scope.warehouseId}` : Prisma.empty;

  const [rows, parameters, demandStats] = await Promise.all([
    prisma.inventory.findMany({ 
      ...(scope?.warehouseId ? { where: { warehouseId: scope.warehouseId } } : {}),
      include: { product: true, warehouse: true } 
    }),
    prisma.planningParameter.findMany({
      ...(scope?.warehouseId ? { where: { warehouseId: scope.warehouseId } } : {}),
    }),
    prisma.$queryRaw<DemandStat[]>`
      SELECT "productId",
             "warehouseId",
             AVG("orderedQuantity")::float8 AS "avgDaily",
             COALESCE(STDDEV_SAMP("orderedQuantity"), 0)::float8 AS "stdDev"
      FROM "DemandHistory"
      WHERE "date" >= ${daysAgo(DEMAND_WINDOW_DAYS)}
      ${warehouseCondition}
      GROUP BY "productId", "warehouseId"
    `,
  ]);

  const parameterByPair = new Map(parameters.map((row) => [pairKey(row.productId, row.warehouseId), row]));
  const demandByPair = new Map(demandStats.map((row) => [pairKey(row.productId, row.warehouseId), row]));

  return rows.map((row) => {
    const key = pairKey(row.productId, row.warehouseId);
    const parameter = parameterByPair.get(key);
    const demand = demandByPair.get(key);

    const avgDailyDemand = demand?.avgDaily ?? 0;
    const profile = {
      avgDailyDemand,
      demandStdDev: demand?.stdDev ?? 0,
      leadTimeDays: parameter?.leadTimeDays ?? 7,
      leadTimeStdDev: parameter?.leadTimeStdDev ?? 0,
      serviceLevel: parameter?.serviceLevel ?? 0.95,
    };

    const unitCost = Number(row.product.unitCost);

    return {
      productId: row.productId,
      warehouseId: row.warehouseId,
      sku: row.product.sku,
      productName: row.product.name,
      category: row.product.category,
      unitCost,
      criticality: row.product.criticality,
      warehouseCode: row.warehouse.code,
      warehouseName: row.warehouse.name,
      warehouseTier: row.warehouse.tier,
      warehouseCapacity: row.warehouse.capacity,
      onHand: row.onHand,
      reserved: row.reserved,
      inTransit: row.inTransit,
      avgDailyDemand: round(avgDailyDemand),
      leadTimeDays: profile.leadTimeDays,
      safetyStock: round(safetyStock(profile)),
      reorderPoint: round(reorderPoint(profile)),
      maximumInventory: parameter?.maximumInventory ?? null,
      stockoutCostPerUnit: parameter?.stockoutCostPerUnit ?? unitCost,
      daysOfSupply: avgDailyDemand > 0 ? round(row.onHand / avgDailyDemand, 1) : 0,
      inventoryValue: round(row.onHand * unitCost),
    };
  });
};

export const loadExpiringBatches = async (horizonDays: number, scope?: { warehouseId?: string | null }): Promise<ExpiringBatch[]> => {
  const batches = await prisma.inventoryBatch.findMany({
    where: { 
      expiryDate: { lte: horizon(horizonDays) }, 
      quantity: { gt: 0 },
      ...(scope?.warehouseId ? { warehouseId: scope.warehouseId } : {})
    },
    select: {
      productId: true,
      warehouseId: true,
      quantity: true,
      expiryDate: true,
      product: { select: { unitCost: true } },
    },
  });

  const now = Date.now();
  return batches.map((batch) => ({
    productId: batch.productId,
    warehouseId: batch.warehouseId,
    quantity: batch.quantity,
    value: batch.quantity * Number(batch.product.unitCost),
    daysToExpiry: Math.ceil((batch.expiryDate.getTime() - now) / 86_400_000),
  }));
};

const totalsBy = (batches: ExpiringBatch[], key: (batch: ExpiringBatch) => string): Map<string, number> => {
  const totals = new Map<string, number>();
  for (const batch of batches) {
    const id = key(batch);
    totals.set(id, (totals.get(id) ?? 0) + batch.value);
  }
  return totals;
};

export const expiringValueByWarehouse = (batches: ExpiringBatch[]): Map<string, number> =>
  totalsBy(batches, (batch) => batch.warehouseId);

export const expiringValueByPosition = (batches: ExpiringBatch[]): Map<string, number> =>
  totalsBy(batches, (batch) => pairKey(batch.productId, batch.warehouseId));

const shortageOf = (position: InventoryPosition) =>
  Math.max(0, position.reorderPoint - position.onHand) * position.unitCost;

const excessOf = (position: InventoryPosition) =>
  position.maximumInventory === null
    ? 0
    : Math.max(0, position.onHand - position.maximumInventory) * position.unitCost;

const isBelowSafetyStock = (position: InventoryPosition) => position.onHand < position.safetyStock;
const isBelowReorderPoint = (position: InventoryPosition) => position.onHand < position.reorderPoint;
const isAboveMaximum = (position: InventoryPosition) =>
  position.maximumInventory !== null && position.onHand > position.maximumInventory;

/**
 * Open recommendations belonging to the latest completed run, which is the set
 * `/api/recommendations` lists. Counting the table outright would add every superseded
 * run's recommendations to the KPI, so the dashboard claimed 798 pending actions while
 * the page a planner opens from it showed 200.
 */
const countOpenRecommendations = async (warehouseId?: string | null): Promise<number> => {
  const latest = await prisma.planningRun.findFirst({
    where: { status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    select: { id: true },
  });
  if (!latest) return 0;

  return prisma.recommendation.count({
    where: {
      planningRunId: latest.id,
      status: "OPEN",
      ...(warehouseId ? { warehouseId } : {}),
    },
  });
};

/**
 * A warehouse filter is checked before it is used.
 *
 * An unknown id would otherwise return an empty network and read as "this DC holds
 * nothing", which hides the typo. `alert.service.ts` takes the same line, and
 * `/expiry-risk` already 404s - this closes the two routes that did not.
 */
const assertWarehouseExists = async (warehouseId?: string | null): Promise<void> => {
  if (!warehouseId) return;
  const exists = await prisma.warehouse.count({ where: { id: warehouseId } });
  if (exists === 0) throw new NotFoundError(`Warehouse '${warehouseId}' not found`);
};

export const getSummary = async (scope?: { warehouseId?: string | null }): Promise<{
  kpis: DashboardKPIs;
  networkHealth: NetworkHealthSummary;
}> => {
  await assertWarehouseExists(scope?.warehouseId);

  const [positions, expiringBatches, pendingRecommendations, forecastAccuracy] = await Promise.all([
    loadPositions(scope),
    loadExpiringBatches(EXPIRY_HORIZON_DAYS, scope),
    countOpenRecommendations(scope?.warehouseId),
    currentAccuracyPercent(scope?.warehouseId),
  ]);

  const totalInventoryValue = sumBy(positions, (row) => row.inventoryValue);
  const belowReorderPoint = positions.filter(isBelowReorderPoint);
  const belowSafetyStock = positions.filter(isBelowSafetyStock);
  const criticalExpiryItems = expiringBatches.filter((batch) => batch.daysToExpiry <= CRITICAL_EXPIRY_DAYS);

  const excessInventoryValue = sumBy(positions, excessOf);
  const shortageValue = sumBy(positions, shortageOf);
  const expiryRiskValue = sumBy(expiringBatches, (batch) => batch.value);

  const stockoutShare = percentage(belowReorderPoint.length, positions.length);
  const expiryShare = percentage(expiryRiskValue, totalInventoryValue);
  const excessShare = percentage(excessInventoryValue, totalInventoryValue);

  return {
    kpis: {
      totalInventoryValue: round(totalInventoryValue),
      skusMonitored: new Set(positions.map((row) => row.productId)).size,
      stockoutRiskItems: belowReorderPoint.length,
      expiryRiskItems: expiringBatches.length,
      onTimeDeliveryRate: null,
      // WP-19. Null when no run has a realised day to score - never a stand-in.
      forecastAccuracy,
      activeAlerts: belowSafetyStock.length + criticalExpiryItems.length,
      pendingRecommendations,
    },
    networkHealth: {
      overallScore: Math.max(0, round(100 - 0.5 * stockoutShare - 0.3 * expiryShare - 0.2 * excessShare, 0)),
      inStockPercentage: percentage(positions.length - belowReorderPoint.length, positions.length),
      atRiskSkuCount: belowSafetyStock.length,
      excessInventoryValue: round(excessInventoryValue),
      shortageValue: round(shortageValue),
    },
  };
};

export const getNetwork = async (query: NetworkQuery, scope?: { warehouseId?: string | null }): Promise<WarehouseStats[]> => {
  await assertWarehouseExists(scope?.warehouseId);

  const [positions, warehouses, expiringBatches] = await Promise.all([
    loadPositions(scope),
    prisma.warehouse.findMany({
      where: { 
        ...(query.tier === undefined ? {} : { tier: query.tier }),
        ...(scope?.warehouseId ? { id: scope.warehouseId } : {})
      },
      orderBy: { code: "asc" },
    }),
    loadExpiringBatches(EXPIRY_HORIZON_DAYS, scope),
  ]);

  const positionsByWarehouse = groupBy(positions, (position) => position.warehouseId);
  const expiringByWarehouse = expiringValueByWarehouse(expiringBatches);

  return warehouses.map((warehouse) => {
    const rows = positionsByWarehouse.get(warehouse.id) ?? [];
    const onHandUnits = sumBy(rows, (row) => row.onHand);
    const belowSafetyStockCount = rows.filter(isBelowSafetyStock).length;

    return {
      id: warehouse.id,
      code: warehouse.code,
      name: warehouse.name,
      region: warehouse.region,
      tier: warehouse.tier,
      capacity: warehouse.capacity,
      skuCount: rows.length,
      onHandUnits: round(onHandUnits),
      utilization: warehouse.capacity ? percentage(onHandUnits, warehouse.capacity) : null,
      inventoryValue: round(sumBy(rows, (row) => row.inventoryValue)),
      belowReorderPointCount: rows.filter(isBelowReorderPoint).length,
      belowSafetyStockCount,
      stockoutRisk: percentage(belowSafetyStockCount, rows.length),
      shortageValue: round(sumBy(rows, shortageOf)),
      excessValue: round(sumBy(rows, excessOf)),
      expiringValue: round(expiringByWarehouse.get(warehouse.id) ?? 0),
    };
  });
};

export const getExpiryRisk = async (query: ExpiryRiskQuery, scope?: { warehouseId?: string | null }): Promise<ExpiryRiskReport> => {
  const effectiveWarehouseId = query.warehouseId ?? scope?.warehouseId;
  
  if (effectiveWarehouseId !== undefined && effectiveWarehouseId !== null) {
    const exists = await prisma.warehouse.count({ where: { id: effectiveWarehouseId } });
    if (exists === 0) throw new NotFoundError(`Warehouse '${effectiveWarehouseId}' not found`);
  }

  const [positions, batches] = await Promise.all([
    loadPositions(scope),
    prisma.inventoryBatch.findMany({
      where: {
        expiryDate: { lte: horizon(query.withinDays) },
        quantity: { gt: 0 },
        ...(effectiveWarehouseId ? { warehouseId: effectiveWarehouseId } : {}),
        ...(query.sku === undefined ? {} : { product: { sku: query.sku } }),
      },
      include: { product: true, warehouse: true },
      orderBy: { expiryDate: "asc" },
    }),
  ]);

  if (query.sku !== undefined && batches.length === 0) {
    const productExists = await prisma.product.count({ where: { sku: query.sku } });
    if (productExists === 0) throw new NotFoundError(`Product '${query.sku}' not found`);
  }

  const demandByPair = new Map(
    positions.map((position) => [pairKey(position.productId, position.warehouseId), position.avgDailyDemand]),
  );

  const wasteByBatch = new Map<string, number>();
  for (const [key, group] of groupBy(batches, (batch) => pairKey(batch.productId, batch.warehouseId))) {
    const waste = projectFefoWaste(
      group.map((batch) => ({ quantity: batch.quantity, daysToExpiry: daysUntil(batch.expiryDate) })),
      demandByPair.get(key) ?? 0,
    );
    group.forEach((batch, index) => wasteByBatch.set(batch.id, waste[index] ?? 0));
  }

  const items: ExpiryRiskItem[] = batches.map((batch) => {
    const key = pairKey(batch.productId, batch.warehouseId);
    const avgDailyDemand = demandByPair.get(key) ?? 0;
    const daysToExpiry = daysUntil(batch.expiryDate);
    const projectedWaste = wasteByBatch.get(batch.id) ?? 0;
    const unitCost = Number(batch.product.unitCost);

    return {
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      productId: batch.productId,
      sku: batch.product.sku,
      productName: batch.product.name,
      category: batch.product.category,
      criticality: batch.product.criticality,
      warehouseId: batch.warehouseId,
      warehouseCode: batch.warehouse.code,
      warehouseName: batch.warehouse.name,
      tier: batch.warehouse.tier,
      quantity: batch.quantity,
      unitCost,
      valueAtRisk: round(batch.quantity * unitCost),
      expiryDate: batch.expiryDate.toISOString(),
      daysToExpiry,
      severity: severityOf(daysToExpiry),
      avgDailyDemand,
      projectedWaste: round(projectedWaste),
      projectedWasteValue: round(projectedWaste * unitCost),
    };
  });

  const matched =
    query.severity === undefined ? items : items.filter((item) => item.severity === query.severity);

  matched.sort(
    (left, right) => left.daysToExpiry - right.daysToExpiry || right.valueAtRisk - left.valueAtRisk,
  );

  const offset = (query.page - 1) * query.pageSize;

  return {
    items: matched.slice(offset, offset + query.pageSize),
    totals: {
      batchCount: matched.length,
      quantity: round(sumBy(matched, (item) => item.quantity)),
      valueAtRisk: round(sumBy(matched, (item) => item.valueAtRisk)),
      projectedWaste: round(sumBy(matched, (item) => item.projectedWaste)),
      projectedWasteValue: round(sumBy(matched, (item) => item.projectedWasteValue)),
    },
  };
};

const SEVERITY_RANK: Record<RiskLevel, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const MIN_ACTIONABLE_UNITS = 1;

interface PositionWaste {
  units: number;
  value: number;
  earliestDays: number;
}

const units = (value: number) => Math.round(value).toLocaleString("en-US");

export const getPriorityActions = async (
  query: PriorityActionsQuery,
  scope?: { warehouseId?: string | null }
): Promise<PriorityActionsReport> => {
  const effectiveWarehouseId = query.warehouseId ?? scope?.warehouseId;
  
  if (effectiveWarehouseId !== undefined && effectiveWarehouseId !== null) {
    const exists = await prisma.warehouse.count({ where: { id: effectiveWarehouseId } });
    if (exists === 0) throw new NotFoundError(`Warehouse '${effectiveWarehouseId}' not found`);
  }

  const [positions, batches] = await Promise.all([
    loadPositions(scope),
    prisma.inventoryBatch.findMany({
      where: { 
        expiryDate: { lte: horizon(EXPIRY_HORIZON_DAYS) }, 
        quantity: { gt: 0 },
        ...(scope?.warehouseId ? { warehouseId: scope.warehouseId } : {})
      },
      select: {
        productId: true,
        warehouseId: true,
        quantity: true,
        expiryDate: true,
        product: { select: { unitCost: true } },
      },
      orderBy: { expiryDate: "asc" },
    }),
  ]);

  const positionByPair = new Map(
    positions.map((position) => [pairKey(position.productId, position.warehouseId), position]),
  );

  const wasteByPosition = new Map<string, PositionWaste>();
  for (const [key, group] of groupBy(batches, (batch) => pairKey(batch.productId, batch.warehouseId))) {
    const waste = projectFefoWaste(
      group.map((batch) => ({ quantity: batch.quantity, daysToExpiry: daysUntil(batch.expiryDate) })),
      positionByPair.get(key)?.avgDailyDemand ?? 0,
    );

    wasteByPosition.set(key, {
      units: sumBy(waste, (value) => value),
      value: group.reduce(
        (total, batch, index) => total + (waste[index] ?? 0) * Number(batch.product.unitCost),
        0,
      ),
      earliestDays: group[0] ? daysUntil(group[0].expiryDate) : Number.POSITIVE_INFINITY,
    });
  }

  const wasteOf = (position: InventoryPosition): PositionWaste =>
    wasteByPosition.get(pairKey(position.productId, position.warehouseId)) ?? {
      units: 0,
      value: 0,
      earliestDays: Number.POSITIVE_INFINITY,
    };

  const actions: PriorityAction[] = [];
  const transferredIn = new Map<string, number>();
  const transferredOut = new Map<string, number>();
  const addTo = (totals: Map<string, number>, key: string, quantity: number) =>
    totals.set(key, (totals.get(key) ?? 0) + quantity);

  const identify = (type: PriorityActionType, position: InventoryPosition) =>
    `${type}:${position.productId}:${position.warehouseId}`;

  const describe = (position: InventoryPosition) => ({
    sku: position.sku,
    productName: position.productName,
    criticality: position.criticality,
    warehouseId: position.warehouseId,
    warehouseCode: position.warehouseCode,
    warehouseName: position.warehouseName,
    tier: position.warehouseTier,
  });

  for (const [, rows] of groupBy(positions, (position) => position.productId)) {
    const transfers = planTransfers({
      positions: rows,
      wasteUnitsOf: (position) => wasteOf(position).units,
      minimumUnits: MIN_ACTIONABLE_UNITS,
    });

    for (const { destination, source, need, available, quantity, unitsRescued } of transfers) {
      addTo(transferredIn, pairKey(destination.productId, destination.warehouseId), quantity);
      addTo(transferredOut, pairKey(source.productId, source.warehouseId), quantity);

      const urgent = destination.daysOfSupply <= destination.leadTimeDays;

      actions.push({
        id: identify("TRANSFER_OPPORTUNITY", destination),
        type: "TRANSFER_OPPORTUNITY",
        severity: urgent ? "critical" : "high",
        ...describe(destination),
        problem: `${units(need)} units short at ${destination.warehouseName} while ${source.warehouseName} holds ${units(available)} above its maximum`,
        recommendedAction: `Transfer ${units(quantity)} units from ${source.warehouseName} to ${destination.warehouseName}`,
        quantity,
        impactValue: round(
          unitsRescued * source.unitCost + quantity * destination.stockoutCostPerUnit,
        ),
        sourceWarehouseCode: source.warehouseCode,
        sourceWarehouseName: source.warehouseName,
      });
    }
  }

  for (const position of positions) {
    const key = pairKey(position.productId, position.warehouseId);
    const waste = wasteOf(position);
    const criticalProduct = position.criticality === "CRITICAL" || position.criticality === "HIGH";

    const shortfall = position.reorderPoint - position.onHand - (transferredIn.get(key) ?? 0);
    const residualWaste = Math.max(0, waste.units - (transferredOut.get(key) ?? 0));
    const residualExcess = Math.max(
      0,
      position.onHand - (position.maximumInventory ?? 0) - (transferredOut.get(key) ?? 0),
    );

    if (shortfall >= MIN_ACTIONABLE_UNITS) {
      const imminent = position.daysOfSupply <= position.leadTimeDays;

      actions.push({
        id: identify(imminent ? "STOCKOUT_IMMINENT" : "BELOW_REORDER_POINT", position),
        type: imminent ? "STOCKOUT_IMMINENT" : "BELOW_REORDER_POINT",
        severity: imminent ? (criticalProduct ? "critical" : "high") : criticalProduct ? "high" : "medium",
        ...describe(position),
        problem: imminent
          ? `${position.daysOfSupply} days of supply against a ${position.leadTimeDays}-day lead time`
          : `${units(position.onHand)} on hand against a reorder point of ${units(position.reorderPoint)}`,
        recommendedAction: imminent
          ? `Expedite ${units(shortfall)} units — a standard order arrives after stock runs out`
          : `Raise a replenishment order for ${units(shortfall)} units`,
        quantity: Math.round(shortfall),
        impactValue: round(shortfall * position.stockoutCostPerUnit),
        sourceWarehouseCode: null,
        sourceWarehouseName: null,
      });
    }

    if (residualWaste >= MIN_ACTIONABLE_UNITS && waste.earliestDays <= CRITICAL_EXPIRY_DAYS) {
      actions.push({
        id: identify("EXPIRY_WRITE_OFF", position),
        type: "EXPIRY_WRITE_OFF",
        severity: waste.earliestDays <= SEVERITY_CRITICAL_DAYS ? "critical" : "high",
        ...describe(position),
        problem: `${units(residualWaste)} units projected to expire unsold, earliest batch in ${waste.earliestDays} days`,
        recommendedAction: `Prioritise FEFO dispatch or redistribute ${units(residualWaste)} units before expiry`,
        quantity: Math.round(residualWaste),
        impactValue: round(residualWaste * position.unitCost),
        sourceWarehouseCode: null,
        sourceWarehouseName: null,
      });
    }

    if (residualExcess >= MIN_ACTIONABLE_UNITS && residualWaste < MIN_ACTIONABLE_UNITS) {
      actions.push({
        id: identify("EXCESS_STOCK", position),
        type: "EXCESS_STOCK",
        severity: residualExcess > (position.maximumInventory ?? 0) * 0.5 ? "medium" : "low",
        ...describe(position),
        problem: `${units(residualExcess)} units above the ${units(position.maximumInventory ?? 0)} maximum`,
        recommendedAction: "Hold procurement and review the maximum for this position",
        quantity: Math.round(residualExcess),
        impactValue: round(residualExcess * position.unitCost),
        sourceWarehouseCode: null,
        sourceWarehouseName: null,
      });
    }
  }

  const matched = actions.filter(
    (action) =>
      (query.warehouseId === undefined || action.warehouseId === query.warehouseId) &&
      (query.severity === undefined || action.severity === query.severity) &&
      (query.type === undefined || action.type === query.type),
  );

  matched.sort(
    (left, right) =>
      SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity] ||
      right.impactValue - left.impactValue,
  );

  const countOf = (severity: RiskLevel) => matched.filter((action) => action.severity === severity).length;

  return {
    items: matched.slice(0, query.limit),
    counts: {
      critical: countOf("critical"),
      high: countOf("high"),
      medium: countOf("medium"),
      low: countOf("low"),
      total: matched.length,
    },
  };
};

export const getInventoryHealth = async (
  query: InventoryHealthQuery,
  scope?: { warehouseId?: string | null }
): Promise<InventoryHealthReport> => {
  const effectiveWarehouseId = query.warehouseId ?? scope?.warehouseId;
  
  if (effectiveWarehouseId !== undefined && effectiveWarehouseId !== null) {
    const exists = await prisma.warehouse.count({ where: { id: effectiveWarehouseId } });
    if (exists === 0) throw new NotFoundError(`Warehouse '${effectiveWarehouseId}' not found`);
  }

  const [allPositions, allBatches] = await Promise.all([
    loadPositions(scope),
    loadExpiringBatches(EXPIRY_HORIZON_DAYS, scope),
  ]);

  const inScope = <T extends { warehouseId: string }>(rows: T[]) =>
    effectiveWarehouseId === undefined || effectiveWarehouseId === null 
      ? rows 
      : rows.filter((row) => row.warehouseId === effectiveWarehouseId);

  const positions = inScope(allPositions);
  const batches = inScope(allBatches);

  const expiringSoon = new Set(
    batches
      .filter((batch) => batch.daysToExpiry <= CRITICAL_EXPIRY_DAYS)
      .map((batch) => pairKey(batch.productId, batch.warehouseId)),
  );
  const expiringValue = expiringValueByPosition(batches);

  const stateOf = (position: InventoryPosition): InventoryHealthState =>
    classifyStock({
      belowSafetyStock: isBelowSafetyStock(position),
      belowReorderPoint: isBelowReorderPoint(position),
      expiringSoon: expiringSoon.has(pairKey(position.productId, position.warehouseId)),
      aboveMaximum: isAboveMaximum(position),
    });

  const states = positions.map(stateOf);
  const countState = (state: InventoryHealthState) => states.filter((value) => value === state).length;

  const byCategory: CategoryHealth[] = [...groupBy(positions, (row) => row.category ?? UNCATEGORIZED)]
    .map(([category, rows]) => ({
      category,
      skuCount: rows.length,
      inventoryValue: round(sumBy(rows, (row) => row.inventoryValue)),
      atRiskCount: rows.filter(isBelowReorderPoint).length,
      expiringValue: round(
        sumBy(rows, (row) => expiringValue.get(pairKey(row.productId, row.warehouseId)) ?? 0),
      ),
    }))
    .sort((left, right) => right.inventoryValue - left.inventoryValue);

  const positionsByCriticality = groupBy(positions, (row) => row.criticality);
  const byCriticality: CriticalityHealth[] = CRITICALITY_ORDER.filter((level) =>
    positionsByCriticality.has(level),
  ).map((criticality) => {
    const rows = positionsByCriticality.get(criticality) ?? [];
    return {
      criticality,
      skuCount: rows.length,
      atRiskCount: rows.filter(isBelowReorderPoint).length,
      stockoutRisk: percentage(rows.filter(isBelowSafetyStock).length, rows.length),
    };
  });

  const categoryValue = byCategory.reduce((total, row) => total + row.inventoryValue, 0);

  return {
    breakdown: {
      criticalStock: countState("criticalStock"),
      belowReorderPoint: countState("belowReorderPoint"),
      expiringSoon: countState("expiringSoon"),
      excessStock: countState("excessStock"),
      healthy: countState("healthy"),
      total: positions.length,
    },
    // Share of positions in each condition, so a legend never has to divide.
    breakdownPercent: {
      criticalStock: percentage(countState("criticalStock"), positions.length),
      belowReorderPoint: percentage(countState("belowReorderPoint"), positions.length),
      expiringSoon: percentage(countState("expiringSoon"), positions.length),
      excessStock: percentage(countState("excessStock"), positions.length),
      healthy: percentage(countState("healthy"), positions.length),
    },
    totalInventoryValue: round(categoryValue),
    conditions: {
      belowSafetyStock: positions.filter(isBelowSafetyStock).length,
      belowReorderPoint: positions.filter(isBelowReorderPoint).length,
      aboveMaximum: positions.filter(isAboveMaximum).length,
      expiringWithin30Days: batches.filter((batch) => batch.daysToExpiry <= CRITICAL_EXPIRY_DAYS).length,
      expiringWithin90Days: batches.length,
    },
    byCategory,
    byCriticality,
  };
};
