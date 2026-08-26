import { prisma } from "../config/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { NotFoundError } from "../utils/errors.js";
import { round } from "../utils/inventory.js";
import type { AccuracyQuery } from "../zod/accuracy.schemas.js";

/**
 * Forecast accuracy: a past run's `Forecast.p50` against realised `DemandHistory`.
 *
 * This is the only place in the codebase that scores a forecast. `/api/forecast/*`
 * and the dashboard KPI both read from here, so a number quoted on one screen cannot
 * disagree with the same number on another.
 *
 * **On this data the figures measure a fixture, not forecast skill.** The seeded
 * demand comes from a generator in `prisma/seed.ts`, and an oracle that knows that
 * generator floors at about 10.65% WAPE - which the model already matches. Report
 * these numbers; do not present them as evidence that accuracy improved until they
 * run against real history.
 */

const MS_PER_DAY = 86_400_000;

const CAVEAT =
  "Seeded demand is generated, so these figures measure how well the model recovers a known formula, not forecast skill on real data";
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

export interface AccuracyMetrics {
  scoredPoints: number;
  accuracyPercent: number | null;
  wapePercent: number | null;
  mapePercent: number | null;
  mapeExcludedPoints?: number;
  maePerDay: number | null;
  rmse: number | null;
  biasPercent: number | null;
}

interface Point {
  forecast: number;
  actual: number;
  productId: string;
  warehouseId: string;
  horizonDay: number;
}

/**
 * Turns matched (forecast, actual) pairs into the standard error measures.
 *
 * **WAPE is the headline, not MAPE.** MAPE divides by each actual, so a single
 * near-zero day dominates the average and reports an error in the thousands of
 * percent. WAPE divides once, by the total, and is stable on intermittent demand -
 * which is most SKU-warehouse pairs.
 */
export const metricsOf = (points: Point[]): AccuracyMetrics => {
  if (points.length === 0) {
    return {
      scoredPoints: 0,
      accuracyPercent: null,
      wapePercent: null,
      mapePercent: null,
      maePerDay: null,
      rmse: null,
      biasPercent: null,
    };
  }

  let absoluteError = 0;
  let squaredError = 0;
  let signedError = 0;
  let actualTotal = 0;
  let percentageErrorSum = 0;
  let percentageErrorPoints = 0;

  for (const point of points) {
    const error = point.forecast - point.actual;
    absoluteError += Math.abs(error);
    squaredError += error * error;
    signedError += error;
    actualTotal += point.actual;

    // A zero actual has no percentage error - the division is undefined, not large.
    if (point.actual > 0) {
      percentageErrorSum += Math.abs(error) / point.actual;
      percentageErrorPoints += 1;
    }
  }

  const wape = actualTotal === 0 ? null : (absoluteError / actualTotal) * 100;

  return {
    scoredPoints: points.length,
    // Bounded at 0: a forecast can be arbitrarily wrong, but "negative accuracy"
    // is not a reading anyone can act on.
    accuracyPercent: wape === null ? null : round(Math.max(0, 100 - wape)),
    wapePercent: wape === null ? null : round(wape),
    mapePercent:
      percentageErrorPoints === 0
        ? null
        : round((percentageErrorSum / percentageErrorPoints) * 100),
    mapeExcludedPoints: points.length - percentageErrorPoints,
    maePerDay: round(absoluteError / points.length),
    rmse: round(Math.sqrt(squaredError / points.length)),
    // Positive means the forecast ran high. The direction matters more than the size:
    // under-forecasting is what causes stockouts.
    biasPercent: actualTotal === 0 ? null : round((signedError / actualTotal) * 100),
  };
};

/**
 * The most recent completed run that has anything to score.
 *
 * Not simply the latest completed run: a run created today forecasts only the
 * future, so it has no realised day and would score `null`. Accuracy is a question
 * about the past, so it looks for the newest run whose horizon has partly elapsed.
 */
export const latestScorableRunId = async (): Promise<string | null> => {
  const row = await prisma.forecast.findFirst({
    where: {
      forecastDate: { lte: new Date() },
      planningRun: { status: "COMPLETED" },
    },
    orderBy: { planningRun: { completedAt: "desc" } },
    select: { planningRunId: true },
  });
  return row?.planningRunId ?? null;
};

const resolveProduct = async (sku: string) => {
  const product = await prisma.product.findFirst({
    where: { OR: [{ id: sku }, { sku }] },
    select: { id: true },
  });
  if (!product) throw new NotFoundError(`Product '${sku}' not found`);
  return product.id;
};

const resolveWarehouse = async (warehouse: string) => {
  const row = await prisma.warehouse.findFirst({
    where: { OR: [{ id: warehouse }, { code: warehouse }] },
    select: { id: true },
  });
  if (!row) throw new NotFoundError(`Warehouse '${warehouse}' not found`);
  return row.id;
};

/** Loads every forecast day that has already happened, matched to what was ordered. */
export const loadScoredPoints = async (
  runId: string,
  filters: { productId?: string; warehouseId?: string },
): Promise<Point[]> => {
  const where: Prisma.ForecastWhereInput = {
    planningRunId: runId,
    forecastDate: { lte: new Date() },
    ...(filters.productId === undefined ? {} : { productId: filters.productId }),
    ...(filters.warehouseId === undefined ? {} : { warehouseId: filters.warehouseId }),
  };

  const forecasts = await prisma.forecast.findMany({
    where,
    select: { productId: true, warehouseId: true, forecastDate: true, p50: true },
  });

  if (forecasts.length === 0) return [];

  // The run's first forecast day, so a horizon offset can be computed. Taken from
  // the whole run rather than the filtered set: day 1 must mean the same thing
  // whether or not the caller narrowed to one warehouse.
  const span = await prisma.forecast.aggregate({
    where: { planningRunId: runId },
    _min: { forecastDate: true },
  });
  const origin = span._min.forecastDate;
  if (!origin) return [];

  const earliest = forecasts.reduce(
    (min, row) => (row.forecastDate < min ? row.forecastDate : min),
    forecasts[0]!.forecastDate,
  );

  const actuals = await prisma.demandHistory.findMany({
    where: {
      date: { gte: earliest },
      ...(filters.productId === undefined ? {} : { productId: filters.productId }),
      ...(filters.warehouseId === undefined ? {} : { warehouseId: filters.warehouseId }),
    },
    select: { productId: true, warehouseId: true, date: true, orderedQuantity: true },
  });

  const actualBy = new Map(
    actuals.map((row) => [
      `${row.productId}:${row.warehouseId}:${isoDay(row.date)}`,
      row.orderedQuantity,
    ]),
  );

  const points: Point[] = [];
  for (const row of forecasts) {
    const actual = actualBy.get(
      `${row.productId}:${row.warehouseId}:${isoDay(row.forecastDate)}`,
    );
    // A forecast day with no realised demand cannot be scored. Treating a missing
    // row as zero would count "we have not loaded that day yet" as "nobody ordered".
    if (actual === undefined) continue;

    points.push({
      forecast: row.p50,
      actual,
      productId: row.productId,
      warehouseId: row.warehouseId,
      horizonDay:
        Math.round((row.forecastDate.getTime() - origin.getTime()) / MS_PER_DAY) + 1,
    });
  }

  return points;
};

const groupBy = <K>(points: Point[], key: (point: Point) => K) => {
  const groups = new Map<K, Point[]>();
  for (const point of points) {
    const bucket = groups.get(key(point));
    if (bucket) bucket.push(point);
    else groups.set(key(point), [point]);
  }
  return groups;
};

export const getAccuracy = async (query: AccuracyQuery, authScope?: { warehouseId?: string | null }) => {
  const effectiveWarehouse = query.warehouse ?? authScope?.warehouseId;
  const [productId, warehouseId] = await Promise.all([
    query.sku === undefined ? undefined : resolveProduct(query.sku),
    effectiveWarehouse === undefined || effectiveWarehouse === null ? undefined : resolveWarehouse(effectiveWarehouse),
  ]);

  let runId: string | null;
  if (query.runId) {
    const run = await prisma.planningRun.findUnique({
      where: { id: query.runId },
      select: { id: true, status: true },
    });
    if (!run) throw new NotFoundError(`Planning run '${query.runId}' not found`);
    runId = run.status === "COMPLETED" ? run.id : null;
  } else {
    runId = await latestScorableRunId();
  }

  const empty = {
    planningRunId: runId,
    modelVersion: null as string | null,
    groupBy: query.groupBy,
    overall: metricsOf([]),
    groups: [] as unknown[],
    note: "No forecast day has been realised yet, so accuracy cannot be measured",
    dataCaveat: CAVEAT,
  };

  if (runId === null) return empty;

  const [points, run] = await Promise.all([
    loadScoredPoints(runId, {
      ...(productId === undefined ? {} : { productId }),
      ...(warehouseId === undefined ? {} : { warehouseId }),
    }),
    prisma.planningRun.findUnique({
      where: { id: runId },
      select: { modelVersion: true, horizonDays: true, completedAt: true },
    }),
  ]);

  if (points.length === 0) return { ...empty, modelVersion: run?.modelVersion ?? null };

  const overall = metricsOf(points);
  const base = {
    planningRunId: runId,
    modelVersion: run?.modelVersion ?? null,
    horizonDays: run?.horizonDays ?? null,
    completedAt: run?.completedAt?.toISOString() ?? null,
    groupBy: query.groupBy,
    overall,
    note: null,
    dataCaveat: CAVEAT,
  };

  if (query.groupBy === "overall") return { ...base, groups: [] };

  if (query.groupBy === "horizon") {
    const groups = [...groupBy(points, (point) => point.horizonDay).entries()]
      .sort(([a], [b]) => a - b)
      .map(([horizonDay, bucket]) => ({ horizonDay, ...metricsOf(bucket) }));
    return { ...base, groups };
  }

  const isSku = query.groupBy === "sku";
  const grouped = [...groupBy(points, (point) => (isSku ? point.productId : point.warehouseId))];

  const labels = isSku
    ? new Map(
        (
          await prisma.product.findMany({
            where: { id: { in: grouped.map(([id]) => id) } },
            select: { id: true, sku: true, name: true },
          })
        ).map((row) => [row.id, { code: row.sku, name: row.name }]),
      )
    : new Map(
        (
          await prisma.warehouse.findMany({
            where: { id: { in: grouped.map(([id]) => id) } },
            select: { id: true, code: true, name: true },
          })
        ).map((row) => [row.id, { code: row.code, name: row.name }]),
      );

  const groups = grouped
    .map(([id, bucket]) => ({
      id,
      code: labels.get(id)?.code ?? null,
      name: labels.get(id)?.name ?? null,
      ...metricsOf(bucket),
    }))
    // Worst first: the point of a breakdown is finding where the model struggles.
    .sort((a, b) => (b.wapePercent ?? 0) - (a.wapePercent ?? 0));

  return { ...base, groups };
};

/** The dashboard KPI. Null when nothing can be scored, never a stand-in figure. */
export const currentAccuracyPercent = async (): Promise<number | null> => {
  const runId = await latestScorableRunId();
  if (runId === null) return null;

  const points = await loadScoredPoints(runId, {});
  return metricsOf(points).accuracyPercent;
};
