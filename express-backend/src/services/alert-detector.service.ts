import { prisma } from "../config/prisma.js";
import { loadPositions, type InventoryPosition } from "./dashboard.service.js";
import { getSettings } from "./settings.service.js";
import { projectFefoWaste, round } from "../utils/inventory.js";
import { OPEN_STATUSES } from "./alert.service.js";

/**
 * The producer behind `/api/alerts`.
 *
 * Every alert route was a reader with nothing writing the table, so the review
 * surface was permanently empty while the dashboard reported dozens of conditions
 * from the same positions. This derives the alerts from that same state, so the two
 * cannot disagree.
 *
 * Detection runs at the end of a planning run: a run is when the network is
 * re-evaluated, and it is already where recommendations are produced.
 */

const MS_PER_DAY = 86_400_000;
const MIN_ACTIONABLE_UNITS = 1;

/** Demand-spike detection compares the recent window against the baseline before it. */
const SPIKE_WINDOW_DAYS = 7;
const SPIKE_BASELINE_DAYS = 28;

type Severity = "critical" | "high" | "medium" | "low";

interface AlertDraft {
  /**
   * Identity of the *condition*, not of the row. Re-detecting the same condition has
   * to find the alert a planner already acknowledged rather than raise a duplicate.
   */
  fingerprint: string;
  severity: Severity;
  type: string;
  title: string;
  sku: string | null;
  product: string | null;
  location: string;
  businessImpact: string;
  recommendedAction: string;
  explanation: string;
  metrics: { label: string; value: string }[];
}

const units = (value: number) => Math.round(value).toLocaleString("en-US");
const money = (value: number) => `$${Math.round(value).toLocaleString("en-US")}`;

const fingerprintOf = (type: string, sku: string | null, location: string) =>
  `${type}|${sku ?? ""}|${location}`;

/** Products flagged CRITICAL or HIGH escalate one band - a stockout there is clinical. */
const escalates = (position: InventoryPosition) =>
  position.criticality === "CRITICAL" || position.criticality === "HIGH";

/**
 * Probability that the position runs out before a replenishment could arrive.
 *
 * Days of supply against lead time, not a share of the reorder point: a position can
 * sit below its reorder point and still be perfectly safe if demand is slow, and the
 * threshold in settings is expressed as a stockout *probability*.
 */
const stockoutProbabilityPercent = (position: InventoryPosition): number => {
  if (position.leadTimeDays <= 0) return position.onHand <= 0 ? 100 : 0;
  const uncovered = position.leadTimeDays - position.daysOfSupply;
  if (uncovered <= 0) return 0;
  return round(Math.min(100, (uncovered / position.leadTimeDays) * 100));
};

const detectStockoutRisk = (
  positions: InventoryPosition[],
  thresholdPercent: number,
): AlertDraft[] => {
  const drafts: AlertDraft[] = [];

  for (const position of positions) {
    const probability = stockoutProbabilityPercent(position);
    if (probability < thresholdPercent) continue;

    const shortfall = Math.max(0, position.reorderPoint - position.onHand);
    if (shortfall < MIN_ACTIONABLE_UNITS) continue;

    const bufferBreached = position.onHand < position.safetyStock;
    const severity: Severity = bufferBreached
      ? escalates(position)
        ? "critical"
        : "high"
      : escalates(position)
        ? "high"
        : "medium";

    drafts.push({
      fingerprint: fingerprintOf("stockout_risk", position.sku, position.warehouseName),
      severity,
      type: "stockout_risk",
      title: `${position.productName} is ${probability}% likely to stock out at ${position.warehouseName}`,
      sku: position.sku,
      product: position.productName,
      location: position.warehouseName,
      businessImpact: `${units(shortfall)} units short of the reorder point, ${money(shortfall * position.stockoutCostPerUnit)} of stockout exposure`,
      recommendedAction: bufferBreached
        ? `Expedite ${units(shortfall)} units — stock is already below the safety buffer`
        : `Raise a replenishment order for ${units(shortfall)} units`,
      explanation: `${position.daysOfSupply} days of supply remain against a ${position.leadTimeDays}-day lead time, so a standard order placed today arrives after stock runs out.`,
      metrics: [
        { label: "On hand", value: units(position.onHand) },
        { label: "Safety stock", value: units(position.safetyStock) },
        { label: "Reorder point", value: units(position.reorderPoint) },
        { label: "Days of supply", value: `${position.daysOfSupply}` },
        { label: "Lead time", value: `${position.leadTimeDays} days` },
        { label: "Stockout probability", value: `${probability}%` },
      ],
    });
  }

  return drafts;
};

interface BatchRow {
  productId: string;
  warehouseId: string;
  quantity: number;
  expiryDate: Date;
  product: { unitCost: unknown };
}

const detectExpiryRisk = (
  positions: InventoryPosition[],
  batches: BatchRow[],
  windowDays: number,
): AlertDraft[] => {
  const drafts: AlertDraft[] = [];
  const byPair = new Map<string, BatchRow[]>();

  for (const batch of batches) {
    const key = `${batch.productId}:${batch.warehouseId}`;
    const bucket = byPair.get(key);
    if (bucket) bucket.push(batch);
    else byPair.set(key, [batch]);
  }

  for (const position of positions) {
    const group = byPair.get(`${position.productId}:${position.warehouseId}`);
    if (!group || group.length === 0) continue;

    const daysToExpiry = group.map((batch) =>
      Math.ceil((batch.expiryDate.getTime() - Date.now()) / MS_PER_DAY),
    );
    const earliestDays = Math.min(...daysToExpiry);
    if (earliestDays > windowDays) continue;

    // Units that demand will not consume before the batch expires, not units that
    // merely carry a near date. Stock that sells through is not a write-off.
    const waste = projectFefoWaste(
      group.map((batch, index) => ({
        quantity: batch.quantity,
        daysToExpiry: daysToExpiry[index] ?? 0,
      })),
      position.avgDailyDemand,
    );

    const wasteUnits = waste.reduce((total, value) => total + value, 0);
    if (wasteUnits < MIN_ACTIONABLE_UNITS) continue;

    const wasteValue = group.reduce(
      (total, batch, index) => total + (waste[index] ?? 0) * Number(batch.product.unitCost),
      0,
    );

    drafts.push({
      fingerprint: fingerprintOf("expiry_risk", position.sku, position.warehouseName),
      severity: earliestDays <= 15 ? "critical" : earliestDays <= 30 ? "high" : "medium",
      type: "expiry_risk",
      title: `${units(wasteUnits)} units of ${position.productName} will expire unsold at ${position.warehouseName}`,
      sku: position.sku,
      product: position.productName,
      location: position.warehouseName,
      businessImpact: `${money(wasteValue)} of stock is projected to be written off`,
      recommendedAction: `Prioritise FEFO dispatch or redistribute ${units(wasteUnits)} units before expiry`,
      explanation: `The earliest batch expires in ${earliestDays} days. At ${round(position.avgDailyDemand)} units of daily demand, consumption clears only part of the stock on hand before that date.`,
      metrics: [
        { label: "Units at risk", value: units(wasteUnits) },
        { label: "Value at risk", value: money(wasteValue) },
        { label: "Earliest expiry", value: `${earliestDays} days` },
        { label: "Batches", value: `${group.length}` },
        { label: "Daily demand", value: units(position.avgDailyDemand) },
      ],
    });
  }

  return drafts;
};

const detectOverstock = (positions: InventoryPosition[]): AlertDraft[] => {
  const drafts: AlertDraft[] = [];

  for (const position of positions) {
    if (position.maximumInventory === null) continue;
    const excess = position.onHand - position.maximumInventory;
    if (excess < MIN_ACTIONABLE_UNITS) continue;

    const excessValue = excess * position.unitCost;
    const coverDays =
      position.avgDailyDemand > 0 ? Math.round(excess / position.avgDailyDemand) : null;

    drafts.push({
      fingerprint: fingerprintOf("overstock", position.sku, position.warehouseName),
      severity: position.onHand > position.maximumInventory * 2 ? "medium" : "low",
      type: "overstock",
      title: `${position.productName} is ${units(excess)} units above its maximum at ${position.warehouseName}`,
      sku: position.sku,
      product: position.productName,
      location: position.warehouseName,
      businessImpact: `${money(excessValue)} of working capital tied up above the maximum level`,
      recommendedAction: `Redistribute ${units(excess)} units to a location that is short, or hold back the next order`,
      explanation:
        coverDays === null
          ? `Stock exceeds the maximum inventory level and this position records no demand to draw it down.`
          : `The excess alone covers ${coverDays} days of demand beyond the maximum inventory level.`,
      metrics: [
        { label: "On hand", value: units(position.onHand) },
        { label: "Maximum", value: units(position.maximumInventory) },
        { label: "Excess units", value: units(excess) },
        { label: "Excess value", value: money(excessValue) },
      ],
    });
  }

  return drafts;
};

const detectCapacityBreach = (
  positions: InventoryPosition[],
  thresholdPercent: number,
): AlertDraft[] => {
  const byWarehouse = new Map<string, { name: string; capacity: number | null; onHand: number }>();

  for (const position of positions) {
    const bucket = byWarehouse.get(position.warehouseId) ?? {
      name: position.warehouseName,
      capacity: position.warehouseCapacity,
      onHand: 0,
    };
    bucket.onHand += position.onHand;
    byWarehouse.set(position.warehouseId, bucket);
  }

  const drafts: AlertDraft[] = [];

  for (const warehouse of byWarehouse.values()) {
    if (warehouse.capacity === null || warehouse.capacity <= 0) continue;
    const utilization = round((warehouse.onHand / warehouse.capacity) * 100);
    if (utilization < thresholdPercent) continue;

    drafts.push({
      fingerprint: fingerprintOf("capacity_breach", null, warehouse.name),
      severity: utilization >= 100 ? "critical" : "high",
      type: "capacity_breach",
      title: `${warehouse.name} is at ${utilization}% of storage capacity`,
      sku: null,
      product: null,
      location: warehouse.name,
      businessImpact:
        utilization >= 100
          ? `Stock on hand exceeds the site's capacity — inbound receipts have nowhere to go`
          : `Only ${units(warehouse.capacity - warehouse.onHand)} units of headroom remain`,
      recommendedAction: `Redistribute stock out of ${warehouse.name} or hold inbound orders until capacity frees up`,
      explanation: `${units(warehouse.onHand)} units are held against a capacity of ${units(warehouse.capacity)}, above the ${thresholdPercent}% alerting threshold.`,
      metrics: [
        { label: "Utilization", value: `${utilization}%` },
        { label: "On hand", value: units(warehouse.onHand) },
        { label: "Capacity", value: units(warehouse.capacity) },
        { label: "Threshold", value: `${thresholdPercent}%` },
      ],
    });
  }

  return drafts;
};

interface SpikeRow {
  productId: string;
  warehouseId: string;
  recent: number;
  baseline: number;
}

const detectDemandSpike = (
  positions: InventoryPosition[],
  spikes: SpikeRow[],
  deviationPercent: number,
): AlertDraft[] => {
  const positionByPair = new Map(
    positions.map((position) => [`${position.productId}:${position.warehouseId}`, position]),
  );

  const drafts: AlertDraft[] = [];

  for (const spike of spikes) {
    if (spike.baseline <= 0) continue;
    const deviation = round(((spike.recent - spike.baseline) / spike.baseline) * 100);
    if (deviation < deviationPercent) continue;

    const position = positionByPair.get(`${spike.productId}:${spike.warehouseId}`);
    if (!position) continue;

    // Demand running hot only matters while stock cannot absorb it.
    const daysAtNewRate = spike.recent > 0 ? Math.floor(position.onHand / spike.recent) : null;
    if (daysAtNewRate !== null && daysAtNewRate > position.leadTimeDays * 2) continue;

    drafts.push({
      fingerprint: fingerprintOf("demand_spike", position.sku, position.warehouseName),
      severity: deviation >= deviationPercent * 2 ? "high" : "medium",
      type: "demand_spike",
      title: `${position.productName} demand is up ${deviation}% at ${position.warehouseName}`,
      sku: position.sku,
      product: position.productName,
      location: position.warehouseName,
      businessImpact:
        daysAtNewRate === null
          ? `Demand is accelerating against the planned buffer`
          : `Stock on hand covers ${daysAtNewRate} days at the new rate against a ${position.leadTimeDays}-day lead time`,
      recommendedAction: `Re-check the replenishment quantity for ${position.sku} against the elevated rate`,
      explanation: `The last ${SPIKE_WINDOW_DAYS} days averaged ${units(spike.recent)} units per day against ${units(spike.baseline)} over the preceding ${SPIKE_BASELINE_DAYS} days, a ${deviation}% deviation above the ${deviationPercent}% alerting threshold.`,
      metrics: [
        { label: "Recent daily demand", value: units(spike.recent) },
        { label: "Baseline daily demand", value: units(spike.baseline) },
        { label: "Deviation", value: `${deviation}%` },
        { label: "On hand", value: units(position.onHand) },
      ],
    });
  }

  return drafts;
};

const loadDemandSpikes = async (): Promise<SpikeRow[]> => {
  const recentFrom = new Date(Date.now() - SPIKE_WINDOW_DAYS * MS_PER_DAY);
  const baselineFrom = new Date(
    Date.now() - (SPIKE_WINDOW_DAYS + SPIKE_BASELINE_DAYS) * MS_PER_DAY,
  );

  return prisma.$queryRaw<SpikeRow[]>`
    SELECT "productId",
           "warehouseId",
           AVG("orderedQuantity") FILTER (WHERE "date" >= ${recentFrom})::float8 AS "recent",
           AVG("orderedQuantity") FILTER (WHERE "date" < ${recentFrom})::float8 AS "baseline"
      FROM "DemandHistory"
     WHERE "date" >= ${baselineFrom}
     GROUP BY "productId", "warehouseId"
    HAVING AVG("orderedQuantity") FILTER (WHERE "date" >= ${recentFrom}) IS NOT NULL
       AND AVG("orderedQuantity") FILTER (WHERE "date" < ${recentFrom}) IS NOT NULL
  `;
};

interface AlertContent {
  severity: string;
  title: string;
  businessImpact: string;
  recommendedAction: string;
  explanation: string;
  metrics: { label: string; value: string }[];
}

/** Everything detection can change on an existing alert, in a comparable form. */
const digestOf = (content: AlertContent) =>
  JSON.stringify([
    content.severity,
    content.title,
    content.businessImpact,
    content.recommendedAction,
    content.explanation,
    content.metrics.map((metric) => [metric.label, metric.value]),
  ]);

const digestOfDraft = (draft: AlertDraft) => digestOf(draft);
const digestOfRow = (row: AlertContent) => digestOf(row);

/**
 * Statements per transaction.
 *
 * A hosted database answers each statement in a batch slowly enough that a hundred
 * updates overrun the transaction budget outright. Reconciliation is idempotent, so
 * splitting it across several transactions costs nothing a later run cannot repair.
 */
const WRITE_CHUNK = 20;

const chunk = <T>(rows: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
};

export interface DetectionOutcome {
  detected: number;
  created: number;
  retained: number;
  resolved: number;
  skipped: boolean;
}

/**
 * Reconciles the alert table with the conditions that currently hold.
 *
 * Three outcomes per condition, and the distinction is the whole point of matching on
 * a fingerprint rather than truncating and re-inserting:
 *
 * - still open, still true  -> the row is updated in place, so the status a planner
 *   set and the moment it was first detected both survive.
 * - true, nothing open      -> a new alert, timestamped now.
 * - open, no longer true    -> resolved automatically, with a timeline entry saying so.
 *
 * `resolved` rows are never matched, so a condition that returns raises a fresh alert
 * instead of silently reopening a closed one.
 */
export const refreshAlerts = async (): Promise<DetectionOutcome> => {
  const settings = await getSettings();
  const { realTimeMonitoring, types, thresholds } = settings.alerts;

  // The toggle means "stop detecting", not "stop reporting" - alerts already raised
  // stay readable, they just stop being reconciled.
  if (!realTimeMonitoring) {
    return { detected: 0, created: 0, retained: 0, resolved: 0, skipped: true };
  }

  const [positions, batches, spikes] = await Promise.all([
    loadPositions(),
    types.expiryRisk
      ? prisma.inventoryBatch.findMany({
          where: {
            quantity: { gt: 0 },
            expiryDate: { lte: new Date(Date.now() + thresholds.expiryWindow * MS_PER_DAY) },
          },
          select: {
            productId: true,
            warehouseId: true,
            quantity: true,
            expiryDate: true,
            product: { select: { unitCost: true } },
          },
          orderBy: { expiryDate: "asc" },
        })
      : Promise.resolve([]),
    types.demandSpike ? loadDemandSpikes() : Promise.resolve([]),
  ]);

  const drafts = [
    ...(types.stockoutRisk
      ? detectStockoutRisk(positions, thresholds.stockoutProbability)
      : []),
    ...(types.expiryRisk ? detectExpiryRisk(positions, batches, thresholds.expiryWindow) : []),
    ...(types.overstock ? detectOverstock(positions) : []),
    ...(types.capacityBreach
      ? detectCapacityBreach(positions, thresholds.capacityUtilization)
      : []),
    ...(types.demandSpike ? detectDemandSpike(positions, spikes, thresholds.demandDeviation) : []),
  ];

  // A condition detected twice is one alert. Later drafts win so the reducer stays
  // total even if two detectors ever key the same way.
  const byFingerprint = new Map(drafts.map((draft) => [draft.fingerprint, draft]));

  const open = await prisma.alert.findMany({
    where: { status: { in: [...OPEN_STATUSES] } },
    select: {
      id: true,
      type: true,
      sku: true,
      location: true,
      severity: true,
      title: true,
      businessImpact: true,
      recommendedAction: true,
      explanation: true,
      metrics: { select: { label: true, value: true } },
    },
  });

  const openByFingerprint = new Map(
    open.map((row) => [fingerprintOf(row.type, row.sku, row.location), row]),
  );

  const creates: AlertDraft[] = [];
  const updates: { id: string; draft: AlertDraft; severityChanged: boolean }[] = [];

  for (const [fingerprint, draft] of byFingerprint) {
    const existing = openByFingerprint.get(fingerprint);
    if (!existing) {
      creates.push(draft);
      continue;
    }

    // A condition that still reads exactly the same is left untouched. Rewriting it
    // would churn every metric row and bump updatedAt on a run that changed nothing.
    if (digestOfRow(existing) === digestOfDraft(draft)) continue;

    updates.push({ id: existing.id, draft, severityChanged: existing.severity !== draft.severity });
  }

  // Only a detector that actually ran can retire its own alerts. Turning a type off
  // stops it being re-detected, which would otherwise sweep every open alert of that
  // type into "condition no longer detected" - claiming the risk cleared when all that
  // changed was a setting. Those alerts freeze instead, as they do when
  // realTimeMonitoring is off entirely.
  const detecting = new Set(
    [
      types.stockoutRisk ? "stockout_risk" : null,
      types.expiryRisk ? "expiry_risk" : null,
      types.overstock ? "overstock" : null,
      types.capacityBreach ? "capacity_breach" : null,
      types.demandSpike ? "demand_spike" : null,
    ].filter((value): value is string => value !== null),
  );

  const stale = open.filter(
    (row) =>
      detecting.has(row.type) &&
      !byFingerprint.has(fingerprintOf(row.type, row.sku, row.location)),
  );

  const now = new Date();

  /**
   * Written as a handful of `createMany` batches rather than nested creates.
   *
   * One `alert.create` carrying its metrics and timeline costs eight statements, and
   * a network this size raises well over a hundred alerts - enough to blow the
   * transaction budget outright against a hosted database. Grouping by table turns
   * that into a fixed handful of statements per phase.
   *
   * The phases are separate transactions on purpose: reconciliation is idempotent, so
   * a fault between them is corrected by the next run rather than losing the work
   * already committed.
   */
  if (creates.length > 0) {
    await prisma.alert.createMany({
      data: creates.map((draft) => ({
        severity: draft.severity,
        type: draft.type,
        title: draft.title,
        sku: draft.sku,
        product: draft.product,
        location: draft.location,
        detectedAt: now,
        businessImpact: draft.businessImpact,
        status: "new",
        recommendedAction: draft.recommendedAction,
        explanation: draft.explanation,
      })),
    });

    // `createMany` returns a count, not rows. Every alert in this batch shares the
    // one `detectedAt` instant, which reads them back without a second key.
    const inserted = await prisma.alert.findMany({
      where: { detectedAt: now },
      select: { id: true, type: true, sku: true, location: true },
    });

    const idByFingerprint = new Map(
      inserted.map((row) => [fingerprintOf(row.type, row.sku, row.location), row.id]),
    );

    const children = creates.flatMap((draft) => {
      const alertId = idByFingerprint.get(draft.fingerprint);
      return alertId === undefined ? [] : [{ alertId, metrics: draft.metrics }];
    });

    await prisma.$transaction([
      prisma.alertMetric.createMany({
        data: children.flatMap(({ alertId, metrics }) =>
          metrics.map((metric) => ({ alertId, ...metric })),
        ),
      }),
      prisma.alertTimelineEvent.createMany({
        data: children.map(({ alertId }) => ({
          alertId,
          time: now,
          description: "Condition detected",
        })),
      }),
    ]);
  }

  for (const batch of chunk(updates, WRITE_CHUNK)) {
    const ids = batch.map(({ id }) => id);

    await prisma.$transaction([
      // The figures move with the network, so metrics are replaced wholesale rather
      // than reconciled row by row. detectedAt and status are deliberately left alone.
      prisma.alertMetric.deleteMany({ where: { alertId: { in: ids } } }),
      prisma.alertMetric.createMany({
        data: batch.flatMap(({ id, draft }) =>
          draft.metrics.map((metric) => ({ alertId: id, ...metric })),
        ),
      }),
      prisma.alertTimelineEvent.createMany({
        data: batch.flatMap(({ id, draft, severityChanged }) =>
          severityChanged
            ? [{ alertId: id, time: now, description: `Severity re-assessed as ${draft.severity}` }]
            : [],
        ),
      }),
      ...batch.map(({ id, draft }) =>
        prisma.alert.update({
          where: { id },
          data: {
            severity: draft.severity,
            title: draft.title,
            businessImpact: draft.businessImpact,
            recommendedAction: draft.recommendedAction,
            explanation: draft.explanation,
          },
        }),
      ),
    ]);
  }

  if (stale.length > 0) {
    const ids = stale.map((row) => row.id);

    await prisma.$transaction([
      prisma.alert.updateMany({ where: { id: { in: ids } }, data: { status: "resolved" } }),
      prisma.alertTimelineEvent.createMany({
        data: ids.map((alertId) => ({
          alertId,
          time: now,
          description: "Condition no longer detected — resolved",
        })),
      }),
    ]);
  }

  return {
    detected: byFingerprint.size,
    created: creates.length,
    retained: updates.length,
    resolved: stale.length,
    skipped: false,
  };
};
