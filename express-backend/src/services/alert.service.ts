import { prisma } from "../config/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { ConflictError, NotFoundError } from "../utils/errors.js";
import { percentage, round } from "../utils/inventory.js";
import type { AlertParams, AlertQuery, AlertTrendQuery } from "../zod/alert.schemas.js";

/**
 * The alert review surface.
 *
 * `Alert.severity`, `type` and `status` are plain strings in the schema, so the
 * values here are conventions rather than enums. They are listed in one place so a
 * filter, a count and a transition cannot drift apart.
 */

const MS_PER_DAY = 86_400_000;
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

export const OPEN_STATUSES = ["new", "acknowledged", "in_progress"] as const;
const SEVERITY_ORDER = ["critical", "high", "medium", "low"] as const;

const whereOf = async (query: Partial<AlertQuery>, scope?: { warehouseId?: string | null }): Promise<Prisma.AlertWhereInput> => {
  let scopeLocation: string | undefined = undefined;
  if (scope?.warehouseId) {
    const warehouse = await prisma.warehouse.findUnique({ where: { id: scope.warehouseId }, select: { name: true } });
    if (!warehouse) throw new NotFoundError(`Warehouse '${scope.warehouseId}' not found`);
    scopeLocation = warehouse.name;
  }

  return {
    ...(query.severity === undefined ? {} : { severity: query.severity }),
    ...(query.type === undefined ? {} : { type: query.type }),
    ...(scopeLocation ? { location: scopeLocation } : query.location === undefined ? {} : { location: query.location }),
    ...(query.status === undefined
      ? {}
      : query.status === "open"
        ? { status: { in: [...OPEN_STATUSES] } }
        : { status: query.status }),
  };
};

const alertSelect = {
  id: true,
  severity: true,
  type: true,
  title: true,
  sku: true,
  product: true,
  location: true,
  detectedAt: true,
  businessImpact: true,
  status: true,
  recommendedAction: true,
  explanation: true,
  updatedAt: true,
  metrics: { select: { id: true, label: true, value: true } },
  timeline: { select: { id: true, time: true, description: true }, orderBy: { time: "asc" } },
} satisfies Prisma.AlertSelect;

type AlertRow = Prisma.AlertGetPayload<{ select: typeof alertSelect }>;

const toAlert = (row: AlertRow) => ({
  id: row.id,
  severity: row.severity,
  type: row.type,
  title: row.title,
  sku: row.sku,
  product: row.product,
  location: row.location,
  status: row.status,
  businessImpact: row.businessImpact,
  recommendedAction: row.recommendedAction,
  explanation: row.explanation,
  detectedAt: row.detectedAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  ageDays: Math.floor((Date.now() - row.detectedAt.getTime()) / MS_PER_DAY),
  metrics: row.metrics,
  timeline: row.timeline.map((event) => ({
    id: event.id,
    time: event.time.toISOString(),
    description: event.description,
  })),
});

export const listAlerts = async (query: AlertQuery, scope?: { warehouseId?: string | null }) => {
  const where = await whereOf(query, scope);

  const [total, rows] = await Promise.all([
    prisma.alert.count({ where }),
    prisma.alert.findMany({
      where,
      select: alertSelect,
      orderBy: { detectedAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return { items: rows.map(toAlert), total };
};

export const getOverview = async (scope?: { warehouseId?: string | null }) => {
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday.getTime() - MS_PER_DAY);

  const where = await whereOf({}, scope);

  const [total, bySeverity, byStatus, today, yesterday] = await Promise.all([
    prisma.alert.count({ where }),
    prisma.alert.groupBy({ by: ["severity"], where, _count: true }),
    prisma.alert.groupBy({ by: ["status"], where, _count: true }),
    prisma.alert.count({ where: { ...where, detectedAt: { gte: startOfToday } } }),
    prisma.alert.count({
      where: { ...where, detectedAt: { gte: startOfYesterday, lt: startOfToday } },
    }),
  ]);

  const severity = Object.fromEntries(bySeverity.map((row) => [row.severity, row._count]));
  const status = Object.fromEntries(byStatus.map((row) => [row.status, row._count]));
  const unresolved = OPEN_STATUSES.reduce((sum, key) => sum + (status[key] ?? 0), 0);
  const resolved = status.resolved ?? 0;

  return {
    // A real total from one count. The route this replaces added critical + high +
    // unresolved + resolved, which counts a critical unresolved alert twice and made
    // the resolved percentage come out too low.
    totalCount: total,
    criticalCount: severity.critical ?? 0,
    highCount: severity.high ?? 0,
    unresolvedCount: unresolved,
    resolvedCount: resolved,
    resolvedPercentage: total === 0 ? null : round((resolved / total) * 100),
    todayCount: today,
    /** Against yesterday's count over the same window. Was hardcoded to 0. */
    todayDelta: today - yesterday,
  };
};

interface AlertTrendPoint {
  date: string;
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export const getTrends = async (query: AlertTrendQuery, scope?: { warehouseId?: string | null }) => {
  const since = new Date(Date.now() - query.days * MS_PER_DAY);
  since.setUTCHours(0, 0, 0, 0);

  const where = await whereOf({}, scope);

  const rows = await prisma.alert.findMany({
    where: { ...where, detectedAt: { gte: since } },
    select: { detectedAt: true, severity: true },
    orderBy: { detectedAt: "asc" },
  });

  // Every day in the window, including the quiet ones: a chart that silently skips
  // empty days draws a straight line through an outage.
  const buckets = new Map<string, Record<string, number>>();
  for (let offset = 0; offset < query.days; offset += 1) {
    buckets.set(isoDay(new Date(since.getTime() + offset * MS_PER_DAY)), {});
  }

  for (const row of rows) {
    const day = isoDay(row.detectedAt);
    const bucket = buckets.get(day);
    if (!bucket) continue;
    bucket[row.severity] = (bucket[row.severity] ?? 0) + 1;
  }

  const points = [...buckets.entries()].map(([date, counts]) => ({
    date,
    total: Object.values(counts).reduce((sum, value) => sum + value, 0),
    ...Object.fromEntries(SEVERITY_ORDER.map((level) => [level, counts[level] ?? 0])),
  })) as AlertTrendPoint[];

  // The window split in half so the chart's footer has a real comparison rather
  // than a figure the client invents.
  const half = Math.floor(points.length / 2);
  const criticalIn = (slice: AlertTrendPoint[]) =>
    slice.reduce((sum, point) => sum + point.critical, 0);

  const previousCritical = criticalIn(points.slice(0, half));
  const currentCritical = criticalIn(points.slice(half));

  return {
    points,
    comparison: {
      halfWindowDays: points.length - half,
      currentCritical,
      previousCritical,
      criticalChangePercent:
        previousCritical === 0
          ? null
          : round(((currentCritical - previousCritical) / previousCritical) * 100),
    },
  };
};

export const getDistribution = async (scope?: { warehouseId?: string | null }) => {
  // Grouped in the database. The route this replaces loaded every alert into memory
  // and reduced in JavaScript, which grows with the table for a result of a few rows.
  const where = await whereOf({}, scope);

  const [byLocation, byType, bySeverity] = await Promise.all([
    prisma.alert.groupBy({ by: ["location"], where, _count: true }),
    prisma.alert.groupBy({ by: ["type"], where, _count: true }),
    prisma.alert.groupBy({ by: ["severity"], where, _count: true }),
  ]);

  const sorted = <T extends { _count: number }>(rows: T[]) =>
    [...rows].sort((a, b) => b._count - a._count);

  const total = byType.reduce((sum, row) => sum + row._count, 0);
  const share = (count: number) => percentage(count, total);

  return {
    totalAlerts: total,
    byLocation: sorted(byLocation).map((row) => ({
      location: row.location,
      count: row._count,
      sharePercent: share(row._count),
    })),
    byType: sorted(byType).map((row) => ({
      type: row.type,
      count: row._count,
      sharePercent: share(row._count),
    })),
    bySeverity: sorted(bySeverity).map((row) => ({
      severity: row.severity,
      count: row._count,
      sharePercent: share(row._count),
    })),
  };
};

/**
 * Health of the alerting pipeline itself.
 *
 * The route this replaces reported 99.9% uptime and 1,420 active sensors. There are
 * no sensors in this system and nothing measures uptime, so both were decoration.
 * These are facts about the alert table that a reader can verify.
 */
export const getHealth = async (scope?: { warehouseId?: string | null }) => {
  const where = await whereOf({}, scope);

  const [total, latest, oldestOpen, openCount] = await Promise.all([
    prisma.alert.count({ where }),
    prisma.alert.findFirst({ where, orderBy: { detectedAt: "desc" }, select: { detectedAt: true } }),
    prisma.alert.findFirst({
      where: { ...where, status: { in: [...OPEN_STATUSES] } },
      orderBy: { detectedAt: "asc" },
      select: { detectedAt: true, id: true },
    }),
    prisma.alert.count({ where: { ...where, status: { in: [...OPEN_STATUSES] } } }),
  ]);

  return {
    alertsTracked: total,
    openAlerts: openCount,
    lastDetectedAt: latest?.detectedAt.toISOString() ?? null,
    oldestOpenAlertId: oldestOpen?.id ?? null,
    oldestOpenAgeDays:
      oldestOpen === null
        ? null
        : Math.floor((Date.now() - oldestOpen.detectedAt.getTime()) / MS_PER_DAY),
  };
};

/** `resolved` is terminal; acknowledging a resolved alert would reopen it by accident. */
const TRANSITIONS: Record<string, { from: string[]; to: string }> = {
  acknowledge: { from: ["new", "in_progress"], to: "acknowledged" },
  resolve: { from: ["new", "acknowledged", "in_progress"], to: "resolved" },
};

const transition = async ({ id }: AlertParams, action: "acknowledge" | "resolve") => {
  const existing = await prisma.alert.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!existing) throw new NotFoundError(`Alert '${id}' not found`);

  const rule = TRANSITIONS[action]!;
  if (!rule.from.includes(existing.status)) {
    throw new ConflictError(`Alert '${id}' is ${existing.status} and cannot be ${action}d`, {
      id,
      status: existing.status,
    });
  }

  const row = await prisma.alert.update({
    where: { id },
    data: {
      status: rule.to,
      // The timeline is the audit trail; a status change that leaves no trace makes
      // the history on the detail view a lie by omission.
      timeline: { create: { time: new Date(), description: `Alert ${rule.to}` } },
    },
    select: alertSelect,
  });

  return toAlert(row);
};

export const acknowledgeAlert = (params: AlertParams) => transition(params, "acknowledge");
export const resolveAlert = (params: AlertParams) => transition(params, "resolve");

export const markAllRead = async () => {
  const result = await prisma.alert.updateMany({
    where: { status: "new" },
    data: { status: "acknowledged" },
  });
  return { updatedCount: result.count };
};
