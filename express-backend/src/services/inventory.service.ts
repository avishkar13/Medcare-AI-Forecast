import { prisma } from "../config/prisma.js";
import { loadPositions, type InventoryPosition } from "./dashboard.service.js";
import {
  availableStock,
  classifyRisk,
  classifyStock,
  expirySeverity,
  inventoryPosition,
  percentage,
  round,
  supplyUrgency,
} from "../utils/inventory.js";
import { NotFoundError } from "../utils/errors.js";
import type { InventoryQuery, SkuInventoryParams } from "../zod/inventory.schemas.js";
import type {
  InventoryListReport,
  InventoryPositionItem,
  InventoryTotals,
  ProductSummary,
  RiskLevel,
  SkuInventoryDetail,
  SkuNetworkPosition,
  StockBatchItem,
} from "../types.js";

const EXPIRY_HORIZON_DAYS = 90;
const CRITICAL_EXPIRY_DAYS = 30;
const RISK_ORDER: Record<RiskLevel, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const pairKey = (productId: string, warehouseId: string) => `${productId}:${warehouseId}`;
const horizon = (days: number) => new Date(Date.now() + days * 86_400_000);
const daysUntil = (date: Date) => Math.ceil((date.getTime() - Date.now()) / 86_400_000);

interface ExpirySummary {
  units: number;
  value: number;
  daysToNearest: number;
}

const loadExpirySummaries = async (): Promise<Map<string, ExpirySummary>> => {
  const batches = await prisma.inventoryBatch.findMany({
    where: { expiryDate: { lte: horizon(EXPIRY_HORIZON_DAYS) }, quantity: { gt: 0 } },
    select: {
      productId: true,
      warehouseId: true,
      quantity: true,
      expiryDate: true,
      product: { select: { unitCost: true } },
    },
  });

  const summaries = new Map<string, ExpirySummary>();

  for (const batch of batches) {
    const key = pairKey(batch.productId, batch.warehouseId);
    const daysToExpiry = daysUntil(batch.expiryDate);
    const current = summaries.get(key);

    if (current) {
      current.units += batch.quantity;
      current.value += batch.quantity * Number(batch.product.unitCost);
      current.daysToNearest = Math.min(current.daysToNearest, daysToExpiry);
    } else {
      summaries.set(key, {
        units: batch.quantity,
        value: batch.quantity * Number(batch.product.unitCost),
        daysToNearest: daysToExpiry,
      });
    }
  }

  return summaries;
};

const toItem = (
  position: InventoryPosition,
  expiry: ExpirySummary | undefined,
): InventoryPositionItem => {
  // The same two measures the counts use, so a row's own status and risk can never
  // contradict the totals summarising it.
  const belowSafetyStock = availableStock(position) < position.safetyStock;
  const belowReorderPoint = inventoryPosition(position) < position.reorderPoint;
  const aboveMaximum =
    position.maximumInventory !== null && position.onHand > position.maximumInventory;
  const daysToNearestExpiry = expiry?.daysToNearest ?? null;

  return {
    productId: position.productId,
    sku: position.sku,
    productName: position.productName,
    category: position.category,
    criticality: position.criticality,
    warehouseId: position.warehouseId,
    warehouseCode: position.warehouseCode,
    warehouseName: position.warehouseName,
    tier: position.warehouseTier,
    onHand: position.onHand,
    reserved: position.reserved,
    inTransit: position.inTransit,
    // The two derived quantities the stock signals are judged on, sent so a reader can
    // check the verdict rather than compare on-hand to the reorder point and disagree.
    available: round(availableStock(position)),
    inventoryPosition: round(inventoryPosition(position)),
    safetyStock: position.safetyStock,
    reorderPoint: position.reorderPoint,
    maximumInventory: position.maximumInventory,
    avgDailyDemand: position.avgDailyDemand,
    leadTimeDays: position.leadTimeDays,
    daysOfSupply: position.daysOfSupply,
    unitCost: position.unitCost,
    inventoryValue: position.inventoryValue,
    expiringUnits: round(expiry?.units ?? 0),
    expiringValue: round(expiry?.value ?? 0),
    // On-hand against the safety buffer. A position with no buffer configured reads
    // as fully covered rather than as a division by zero.
    bufferCoveragePercent:
      position.safetyStock > 0 ? percentage(position.onHand, position.safetyStock) : 100,
    daysToNearestExpiry,
    status: classifyStock({
      belowSafetyStock,
      belowReorderPoint,
      expiringSoon: daysToNearestExpiry !== null && daysToNearestExpiry <= CRITICAL_EXPIRY_DAYS,
      aboveMaximum,
    }),
    risk: classifyRisk({ belowSafetyStock, belowReorderPoint, aboveMaximum, daysToNearestExpiry }),
  };
};

const totalsOf = (items: InventoryPositionItem[]): InventoryTotals => ({
  positionCount: items.length,
  skuCount: new Set(items.map((item) => item.productId)).size,
  warehouseCount: new Set(items.map((item) => item.warehouseId)).size,
  onHandUnits: round(items.reduce((total, item) => total + item.onHand, 0)),
  inventoryValue: round(items.reduce((total, item) => total + item.inventoryValue, 0)),
  // The same two measures the dashboard and the detector use. This was a third copy of
  // the arithmetic on raw on-hand, so the moment the other two started counting reserved
  // and in-transit stock the routes disagreed - which `inventory.test.ts` caught.
  belowSafetyStockCount: items.filter((item) => item.available < item.safetyStock).length,
  belowReorderPointCount: items.filter((item) => item.inventoryPosition < item.reorderPoint)
    .length,
  aboveMaximumCount: items.filter(
    (item) => item.maximumInventory !== null && item.onHand > item.maximumInventory,
  ).length,
  expiringValue: round(items.reduce((total, item) => total + item.expiringValue, 0)),
  // Positions at or above their reorder point, as a share of all positions.
  inStockRatePercent: percentage(
    items.length - items.filter((item) => item.inventoryPosition < item.reorderPoint).length,
    items.length,
  ),
});

const matchesSearch = (item: InventoryPositionItem, search: string): boolean => {
  const needle = search.toLowerCase();
  return item.sku.toLowerCase().includes(needle) || item.productName.toLowerCase().includes(needle);
};

const matchesWarehouse = (item: InventoryPositionItem, warehouse: string): boolean => {
  const needle = warehouse.toLowerCase();
  return (
    item.warehouseId === warehouse ||
    item.warehouseCode.toLowerCase() === needle ||
    item.warehouseName.toLowerCase() === needle
  );
};


const sorters: Record<
  InventoryQuery["sort"],
  (left: InventoryPositionItem, right: InventoryPositionItem) => number
> = {
  sku: (left, right) =>
    left.sku.localeCompare(right.sku) || left.warehouseCode.localeCompare(right.warehouseCode),
  risk: (left, right) =>
    RISK_ORDER[left.risk] - RISK_ORDER[right.risk] || right.inventoryValue - left.inventoryValue,
  daysOfSupply: (left, right) =>
    supplyUrgency(left) - supplyUrgency(right) || left.sku.localeCompare(right.sku),
  inventoryValue: (left, right) =>
    right.inventoryValue - left.inventoryValue || left.sku.localeCompare(right.sku),
};

export const listInventory = async (
  query: InventoryQuery,
  authScope?: { warehouseId?: string | null }
): Promise<{ report: InventoryListReport; total: number }> => {
  const [positions, expiry] = await Promise.all([loadPositions(authScope), loadExpirySummaries()]);

  const items = positions.map((position) =>
    toItem(position, expiry.get(pairKey(position.productId, position.warehouseId))),
  );

  const warehouse = query.warehouse;
  if (warehouse !== undefined && !items.some((item) => matchesWarehouse(item, warehouse))) {
    throw new NotFoundError(`Warehouse '${warehouse}' not found`);
  }

  const filtered = items
    .filter((item) => (query.search === undefined ? true : matchesSearch(item, query.search)))
    .filter((item) => (query.category === undefined ? true : item.category === query.category))
    .filter((item) => (query.warehouse === undefined ? true : matchesWarehouse(item, query.warehouse)))
    .filter((item) =>
      query.criticality === undefined ? true : item.criticality === query.criticality,
    )
    .filter((item) => (query.status === undefined ? true : item.status === query.status))
    .filter((item) => (query.risk === undefined ? true : item.risk === query.risk))
    .sort(sorters[query.sort]);

  const start = (query.page - 1) * query.pageSize;

  return {
    report: { items: filtered.slice(start, start + query.pageSize), totals: totalsOf(filtered) },
    total: filtered.length,
  };
};

/**
 * One SKU's position rolled up across every warehouse holding it.
 *
 * `stockScaleUnits` is the ceiling a stock bar should be drawn against: the network
 * maximum where one is configured, otherwise the largest real figure among the
 * thresholds. Sent so a chart never has to pad an axis with a made-up multiplier.
 */
const networkPositionOf = (items: InventoryPositionItem[]): SkuNetworkPosition => {
  const sum = (pick: (item: InventoryPositionItem) => number) =>
    round(items.reduce((total, item) => total + pick(item), 0));

  const worst = items.reduce<InventoryPositionItem | undefined>(
    (acc, item) => (acc === undefined || item.daysOfSupply < acc.daysOfSupply ? item : acc),
    undefined,
  );

  const onHand = sum((item) => item.onHand);
  const safetyStock = sum((item) => item.safetyStock);
  const reorderPoint = sum((item) => item.reorderPoint);
  const maximumInventory = sum((item) => item.maximumInventory ?? 0);

  return {
    warehouseCount: items.length,
    onHand,
    available: sum((item) => item.available),
    safetyStock,
    reorderPoint,
    maximumInventory,
    avgDailyDemand: sum((item) => item.avgDailyDemand),
    inventoryValue: sum((item) => item.inventoryValue),
    expiringUnits: sum((item) => item.expiringUnits),
    expiringValue: sum((item) => item.expiringValue),
    leadTimeDays: worst?.leadTimeDays ?? 0,
    daysOfSupply: worst?.daysOfSupply ?? 0,
    risk: worst?.risk ?? "low",
    stockScaleUnits: Math.max(maximumInventory, onHand, reorderPoint, safetyStock),
  };
};

export const getSkuInventory = async ({ id }: SkuInventoryParams, authScope?: { warehouseId?: string | null }): Promise<SkuInventoryDetail> => {
  const product = await prisma.product.findFirst({ where: { OR: [{ id }, { sku: id }] } });
  if (!product) throw new NotFoundError(`Product '${id}' not found`);

  const [positions, expiry, batches] = await Promise.all([
    loadPositions(authScope),
    loadExpirySummaries(),
    prisma.inventoryBatch.findMany({
      where: {
        productId: product.id,
        quantity: { gt: 0 },
        ...(authScope?.warehouseId ? { warehouseId: authScope.warehouseId } : {})
      },
      include: { warehouse: { select: { code: true, name: true } } },
      orderBy: { expiryDate: "asc" },
    }),
  ]);

  const unitCost = Number(product.unitCost);

  const items = positions
    .filter((position) => position.productId === product.id)
    .map((position) =>
      toItem(position, expiry.get(pairKey(position.productId, position.warehouseId))),
    )
    .sort((left, right) => left.warehouseCode.localeCompare(right.warehouseCode));

  const summary: ProductSummary = {
    id: product.id,
    sku: product.sku,
    name: product.name,
    category: product.category,
    unit: product.unit,
    unitCost,
    shelfLifeDays: product.shelfLifeDays,
    criticality: product.criticality,
    isActive: product.isActive,
  };

  const stockBatches: StockBatchItem[] = batches.map((batch) => {
    const daysToExpiry = daysUntil(batch.expiryDate);

    return {
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      warehouseId: batch.warehouseId,
      warehouseCode: batch.warehouse.code,
      warehouseName: batch.warehouse.name,
      quantity: batch.quantity,
      unitCost,
      valueAtRisk: round(batch.quantity * unitCost),
      manufacturingDate: batch.manufacturingDate?.toISOString() ?? null,
      expiryDate: batch.expiryDate.toISOString(),
      daysToExpiry,
      severity: expirySeverity(daysToExpiry),
    };
  });

  return {
    product: summary,
    totals: totalsOf(items),
    network: networkPositionOf(items),
    positions: items,
    batches: stockBatches,
  };
};
