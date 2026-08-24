import { prisma } from "../config/prisma.js";
import { percentage, reorderPoint, round, safetyStock } from "../utils/inventory.js";
import type { DashboardKPIs, NetworkHealthSummary } from "../types.js";

const DEMAND_WINDOW_DAYS = 90;
const EXPIRY_HORIZON_DAYS = 90;
const CRITICAL_EXPIRY_DAYS = 30;

export interface InventoryPosition {
  productId: string;
  warehouseId: string;
  sku: string;
  productName: string;
  category: string | null;
  unitCost: number;
  criticality: string;
  warehouseName: string;
  warehouseTier: string;
  warehouseCapacity: number | null;
  onHand: number;
  avgDailyDemand: number;
  leadTimeDays: number;
  safetyStock: number;
  reorderPoint: number;
  maximumInventory: number | null;
  daysOfSupply: number;
  inventoryValue: number;
}

interface DemandStat {
  productId: string;
  warehouseId: string;
  avgDaily: number;
  stdDev: number;
}

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

export const loadPositions = async (): Promise<InventoryPosition[]> => {
  const [rows, parameters, demandStats] = await Promise.all([
    prisma.inventory.findMany({ include: { product: true, warehouse: true } }),
    prisma.planningParameter.findMany(),
    prisma.$queryRaw<DemandStat[]>`
      SELECT "productId",
             "warehouseId",
             AVG("orderedQuantity")::float8 AS "avgDaily",
             COALESCE(STDDEV_SAMP("orderedQuantity"), 0)::float8 AS "stdDev"
      FROM "DemandHistory"
      WHERE "date" >= ${daysAgo(DEMAND_WINDOW_DAYS)}
      GROUP BY "productId", "warehouseId"
    `,
  ]);

  const parameterByPair = new Map(parameters.map((row) => [`${row.productId}:${row.warehouseId}`, row]));
  const demandByPair = new Map(demandStats.map((row) => [`${row.productId}:${row.warehouseId}`, row]));

  return rows.map((row) => {
    const key = `${row.productId}:${row.warehouseId}`;
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
      warehouseName: row.warehouse.name,
      warehouseTier: row.warehouse.tier,
      warehouseCapacity: row.warehouse.capacity,
      onHand: row.onHand,
      avgDailyDemand: round(avgDailyDemand),
      leadTimeDays: profile.leadTimeDays,
      safetyStock: round(safetyStock(profile)),
      reorderPoint: round(reorderPoint(profile)),
      maximumInventory: parameter?.maximumInventory ?? null,
      daysOfSupply: avgDailyDemand > 0 ? round(row.onHand / avgDailyDemand, 1) : 0,
      inventoryValue: round(row.onHand * unitCost),
    };
  });
};

export const getSummary = async (): Promise<{
  kpis: DashboardKPIs;
  networkHealth: NetworkHealthSummary;
}> => {
  const expiryHorizon = new Date(Date.now() + EXPIRY_HORIZON_DAYS * 86_400_000);
  const criticalExpiryHorizon = new Date(Date.now() + CRITICAL_EXPIRY_DAYS * 86_400_000);

  const [positions, expiryRiskItems, criticalExpiryItems, pendingRecommendations] = await Promise.all([
    loadPositions(),
    prisma.inventoryBatch.count({ where: { expiryDate: { lte: expiryHorizon }, quantity: { gt: 0 } } }),
    prisma.inventoryBatch.count({ where: { expiryDate: { lte: criticalExpiryHorizon }, quantity: { gt: 0 } } }),
    prisma.recommendation.count({ where: { status: "OPEN" } }),
  ]);

  const totalInventoryValue = positions.reduce((total, row) => total + row.inventoryValue, 0);
  const belowReorderPoint = positions.filter((row) => row.onHand < row.reorderPoint);
  const belowSafetyStock = positions.filter((row) => row.onHand < row.safetyStock);

  const excessInventoryValue = positions.reduce(
    (total, row) =>
      row.maximumInventory === null
        ? total
        : total + Math.max(0, row.onHand - row.maximumInventory) * row.unitCost,
    0,
  );

  const shortageValue = positions.reduce(
    (total, row) => total + Math.max(0, row.reorderPoint - row.onHand) * row.unitCost,
    0,
  );

  const expiryValueAtRisk = await prisma.inventoryBatch.findMany({
    where: { expiryDate: { lte: expiryHorizon }, quantity: { gt: 0 } },
    select: { quantity: true, product: { select: { unitCost: true } } },
  });
  const expiryRiskValue = expiryValueAtRisk.reduce(
    (total, batch) => total + batch.quantity * Number(batch.product.unitCost),
    0,
  );

  const inStockPercentage = percentage(positions.length - belowReorderPoint.length, positions.length);
  const stockoutShare = percentage(belowReorderPoint.length, positions.length);
  const expiryShare = percentage(expiryRiskValue, totalInventoryValue);
  const excessShare = percentage(excessInventoryValue, totalInventoryValue);

  return {
    kpis: {
      totalInventoryValue: round(totalInventoryValue),
      skusMonitored: new Set(positions.map((row) => row.productId)).size,
      stockoutRiskItems: belowReorderPoint.length,
      expiryRiskItems,
      onTimeDeliveryRate: null,
      forecastAccuracy: null,
      activeAlerts: belowSafetyStock.length + criticalExpiryItems,
      pendingRecommendations,
    },
    networkHealth: {
      overallScore: Math.max(
        0,
        round(100 - 0.5 * stockoutShare - 0.3 * expiryShare - 0.2 * excessShare, 0),
      ),
      inStockPercentage,
      atRiskSkuCount: belowSafetyStock.length,
      excessInventoryValue: round(excessInventoryValue),
      shortageValue: round(shortageValue),
    },
  };
};
