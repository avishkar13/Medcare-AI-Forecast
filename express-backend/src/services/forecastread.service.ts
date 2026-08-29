import { prisma } from "../config/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { NotFoundError } from "../utils/errors.js";
import { round } from "../utils/inventory.js";
import { loadScoredPoints, metricsOf } from "./forecast-accuracy.service.js";
import { fetchModelMetrics } from "../lib/forecast-client.js";
import { modelMetricsSchema } from "../zod/forecast.schemas.js";
import type { ForecastChartQuery, ForecastQuery } from "../zod/forecastread.schemas.js";

/**
 * Read side of the forecast: what a completed planning run predicted.
 *
 * Every figure here comes from a `Forecast` row or from `DemandHistory`. Where a
 * number cannot be derived it is `null` and `planningRunId` says which run was read
 * - never a plausible-looking constant. A dashboard showing an invented accuracy is
 * worse than one showing none, because nobody goes looking for the bug.
 */

const MS_PER_DAY = 86_400_000;

// No completed run must mean "no rows", not "every row". A cuid can never equal this,
// so the filter matches nothing rather than collapsing to an unfiltered query.
const NO_RUN = "__no_completed_run__";
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

interface Scope {
  runId: string | null;
  modelVersion: string | null;
  productId?: string;
  warehouseId?: string;
  where: Prisma.ForecastWhereInput;
  historyWhere: Prisma.DemandHistoryWhereInput;
}

const resolveProduct = async (sku: string): Promise<string> => {
  const product = await prisma.product.findFirst({
    where: { OR: [{ id: sku }, { sku }] },
    select: { id: true },
  });
  if (!product) throw new NotFoundError(`Product '${sku}' not found`);
  return product.id;
};

const resolveWarehouse = async (warehouse: string): Promise<string> => {
  const row = await prisma.warehouse.findFirst({
    where: { OR: [{ id: warehouse }, { code: warehouse }] },
    select: { id: true },
  });
  if (!row) throw new NotFoundError(`Warehouse '${warehouse}' not found`);
  return row.id;
};

/**
 * Which run to read, plus the filters every route applies.
 *
 * An unknown `runId` is a 404, but *no completed run at all* is not an error - it is
 * the honest state of a system nobody has run yet, and each route answers with nulls.
 */
const resolveScope = async (query: ForecastQuery, authScope?: { warehouseId?: string | null }): Promise<Scope> => {
  const effectiveWarehouse = query.warehouse ?? authScope?.warehouseId;
  const [productId, warehouseId] = await Promise.all([
    query.sku === undefined ? undefined : resolveProduct(query.sku),
    effectiveWarehouse === undefined || effectiveWarehouse === null ? undefined : resolveWarehouse(effectiveWarehouse),
  ]);

  const run = query.runId
    ? await prisma.planningRun.findUnique({
        where: { id: query.runId },
        select: { id: true, status: true, modelVersion: true },
      })
    : await prisma.planningRun.findFirst({
        where: { status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
        select: { id: true, status: true, modelVersion: true },
      });

  if (query.runId && !run) throw new NotFoundError(`Planning run '${query.runId}' not found`);

  // Artefacts of a run that never completed are unreachable by contract.
  const usable = run && run.status === "COMPLETED" ? run : null;

  const base = {
    ...(productId === undefined ? {} : { productId }),
    ...(warehouseId === undefined ? {} : { warehouseId }),
  };

  return {
    runId: usable?.id ?? null,
    modelVersion: usable?.modelVersion ?? null,
    ...(productId === undefined ? {} : { productId }),
    ...(warehouseId === undefined ? {} : { warehouseId }),
    where: { planningRunId: usable?.id ?? NO_RUN, ...base },
    historyWhere: base,
  };
};

/** Applies `days` by trimming to the first N calendar days of the horizon. */
const withHorizon = async (scope: Scope, days?: number): Promise<Prisma.ForecastWhereInput> => {
  if (days === undefined || scope.runId === null) return scope.where;

  const first = await prisma.forecast.aggregate({
    where: scope.where,
    _min: { forecastDate: true },
  });
  const start = first._min.forecastDate;
  if (!start) return scope.where;

  return {
    ...scope.where,
    forecastDate: { lte: new Date(start.getTime() + (days - 1) * MS_PER_DAY) },
  };
};

const emptyMeta = (scope: Scope) => ({
  planningRunId: scope.runId,
  modelVersion: scope.modelVersion,
});

/** Forecast totals per day, oldest first. */
const dailyForecast = async (where: Prisma.ForecastWhereInput) => {
  const rows = await prisma.forecast.groupBy({
    by: ["forecastDate"],
    where,
    _sum: { p10: true, p50: true, p90: true },
    orderBy: { forecastDate: "asc" },
  });

  return rows.map((row) => ({
    date: isoDay(row.forecastDate),
    p10: round(row._sum.p10 ?? 0),
    p50: round(row._sum.p50 ?? 0),
    p90: round(row._sum.p90 ?? 0),
  }));
};

/**
 * Distinct calendar days in the horizon.
 *
 * Not `_count` on a grouped query: that counts forecast *rows*, which is days x
 * products x warehouses. Dividing a total by it produced a per-day figure 40x too
 * small and a growth rate of -98% against trailing demand.
 */
const horizonLength = async (where: Prisma.ForecastWhereInput): Promise<number> => {
  const days = await prisma.forecast.groupBy({ by: ["forecastDate"], where, _count: true });
  return days.length;
};

const mean = (values: number[]) =>
  values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;

export const getKpi = async (query: ForecastQuery, authScope?: { warehouseId?: string | null }) => {
  const scope = await resolveScope(query, authScope);
  const where = await withHorizon(scope, query.days);

  if (scope.runId === null) {
    return {
      ...emptyMeta(scope),
      forecastedDemand: null,
      forecastHorizonDays: null,
      expectedPeakDemand: null,
      peakDate: null,
      averageDailyDemand: null,
      forecastAccuracy: null,
    };
  }

  const [totals, days] = await Promise.all([
    prisma.forecast.aggregate({ where, _sum: { p50: true }, _count: true }),
    dailyForecast(where),
  ]);

  const peak = days.reduce<{ date: string; p50: number } | null>(
    (best, day) => (best === null || day.p50 > best.p50 ? { date: day.date, p50: day.p50 } : best),
    null,
  );

  return {
    ...emptyMeta(scope),
    forecastedDemand: round(totals._sum.p50 ?? 0),
    forecastHorizonDays: days.length,
    expectedPeakDemand: peak?.p50 ?? null,
    peakDate: peak?.date ?? null,
    averageDailyDemand: round(mean(days.map((day) => day.p50))),
    // Measured against realised demand by `performance`; not guessed at here.
    forecastAccuracy: (await accuracyOf(scope)).accuracyPercent,
  };
};

export const getSummary = async (query: ForecastQuery, authScope?: { warehouseId?: string | null }) => {
  const scope = await resolveScope(query, authScope);
  const days = scope.runId === null ? [] : await dailyForecast(await withHorizon(scope, query.days));

  if (days.length === 0) {
    return {
      ...emptyMeta(scope),
      averageDailyDemand: null,
      minExpectedDemand: null,
      maxExpectedDemand: null,
      confidenceRange: null,
      expectedTrend: null,
    };
  }

  const p50s = days.map((day) => day.p50);
  const first = mean(p50s.slice(0, Math.ceil(p50s.length / 2)));
  const second = mean(p50s.slice(Math.ceil(p50s.length / 2)));
  const changePercent = first === 0 ? 0 : ((second - first) / first) * 100;

  return {
    ...emptyMeta(scope),
    averageDailyDemand: round(mean(p50s)),
    minExpectedDemand: round(Math.min(...p50s)),
    maxExpectedDemand: round(Math.max(...p50s)),
    // The band the model itself published, not a confidence interval invented here.
    confidenceRange: [round(mean(days.map((d) => d.p10))), round(mean(days.map((d) => d.p90)))],
    expectedTrend: changePercent > 2 ? "Growing" : changePercent < -2 ? "Declining" : "Stable",
    trendChangePercent: round(changePercent),
  };
};

export const getMainChart = async (query: ForecastChartQuery, authScope?: { warehouseId?: string | null }) => {
  const scope = await resolveScope(query, authScope);
  const predicted = scope.runId === null ? [] : await dailyForecast(await withHorizon(scope, query.days));

  const since = new Date(Date.now() - query.historyDays * MS_PER_DAY);
  const historyRows =
    query.historyDays === 0
      ? []
      : await prisma.demandHistory.groupBy({
          by: ["date"],
          where: { ...scope.historyWhere, date: { gte: since } },
          _sum: { orderedQuantity: true },
          orderBy: { date: "asc" },
        });

  return {
    ...emptyMeta(scope),
    history: historyRows.map((row) => ({
      date: isoDay(row.date),
      actualDemand: round(row._sum.orderedQuantity ?? 0),
    })),
    // Separate arrays, not one series with nulls: history and prediction do not
    // overlap in time, and merging them invites a chart to imply they do.
    prediction: predicted.map((day) => ({
      date: day.date,
      predictedDemand: day.p50,
      lowerBound: day.p10,
      upperBound: day.p90,
    })),
  };
};

export const getTrend = async (query: ForecastQuery, authScope?: { warehouseId?: string | null }) => {
  const scope = await resolveScope(query, authScope);
  const days = scope.runId === null ? [] : await dailyForecast(await withHorizon(scope, query.days));

  if (days.length === 0) {
    // Same keys on both branches: a caller should not have to test for a field's
    // existence to tell "no run yet" from "no trend".
    return {
      ...emptyMeta(scope),
      sevenDayTrend: null,
      thirtyDayTrend: null,
      relativeBandWidth: null,
      demandVolatility: null,
      horizonDays: 0,
    };
  }

  const baseline = mean(days.slice(0, 7).map((day) => day.p50));

  /**
   * The last week inside `window`, against the first week of the horizon.
   *
   * `window` used to start the later slice at `window - 7`, so asking for 7 compared
   * the first week to itself and the seven-day trend was structurally 0 - never a
   * reading, always a zero. A comparison needs two different weeks, so the shortest
   * meaningful window is 14.
   */
  const changeOver = (window: number) => {
    if (window < 14 || days.length < window || baseline === 0) return null;
    const later = mean(days.slice(window - 7, window).map((day) => day.p50));
    return round(((later - baseline) / baseline) * 100);
  };

  // Relative band width: how uncertain the model itself says it is.
  const spread = mean(days.map((day) => (day.p50 === 0 ? 0 : (day.p90 - day.p10) / day.p50)));

  return {
    ...emptyMeta(scope),
    // Week two against week one, and the last week of a month against its first.
    sevenDayTrend: changeOver(14),
    thirtyDayTrend: changeOver(30),
    relativeBandWidth: round(spread),
    demandVolatility: spread > 0.8 ? "High" : spread > 0.4 ? "Moderate" : "Low",
    // So a caller can say "needs a 30-day horizon" rather than rendering a bare dash.
    horizonDays: days.length,
  };
};

/** Weekday and month indices measured from realised demand, centred on 1.0. */
export const getSeasonality = async (query: ForecastQuery, authScope?: { warehouseId?: string | null }) => {
  const scope = await resolveScope(query, authScope);

  const rows = await prisma.demandHistory.findMany({
    where: scope.historyWhere,
    select: { date: true, orderedQuantity: true },
  });

  if (rows.length === 0) {
    return { ...emptyMeta(scope), weeklyPattern: [], monthlyPattern: [], seasonalUpliftPercent: null };
  }

  const overall = mean(rows.map((row) => row.orderedQuantity));
  const bucket = (key: (date: Date) => number) => {
    const sums = new Map<number, { total: number; count: number }>();
    for (const row of rows) {
      const index = key(row.date);
      const current = sums.get(index) ?? { total: 0, count: 0 };
      current.total += row.orderedQuantity;
      current.count += 1;
      sums.set(index, current);
    }
    return sums;
  };

  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const weekday = bucket((date) => date.getUTCDay());
  const month = bucket((date) => date.getUTCMonth());

  const toEntries = <T>(sums: Map<number, { total: number; count: number }>, label: (i: number) => T) =>
    [...sums.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([index, value]) => {
        const seasonalIndex = round(overall === 0 ? 1 : value.total / value.count / overall, 3);
        return {
          label: label(index),
          averageDemand: round(value.total / value.count),
          index: seasonalIndex,
          // The same index as a percentage of average, which is what a chart plots.
          indexPercent: round(seasonalIndex * 100),
        };
      });

  const weeklyPattern = toEntries(weekday, (index) => DAYS[index] ?? String(index));
  const indices = weeklyPattern.map((entry) => entry.index);

  return {
    ...emptyMeta(scope),
    weeklyPattern,
    monthlyPattern: toEntries(month, (index) => MONTHS[index] ?? String(index + 1)),
    // Peak weekday against the average one - the size of the swing a planner must cover.
    seasonalUpliftPercent: indices.length === 0 ? null : round((Math.max(...indices) - 1) * 100),
  };
};

const groupedForecast = async (
  where: Prisma.ForecastWhereInput,
  by: "warehouseId" | "productId",
) =>
  prisma.forecast.groupBy({
    by: [by],
    where,
    _sum: { p10: true, p50: true, p90: true },
    _count: true,
  });

export const getNetwork = async (query: ForecastQuery, authScope?: { warehouseId?: string | null }) => {
  const scope = await resolveScope(query, authScope);
  const where = await withHorizon(scope, query.days);

  const [warehouses, forecast, history, horizonDays] = await Promise.all([
    prisma.warehouse.findMany({ select: { id: true, code: true, name: true, tier: true, region: true } }),
    scope.runId === null ? [] : groupedForecast(where, "warehouseId"),
    prisma.demandHistory.groupBy({
      by: ["warehouseId"],
      where: { ...scope.historyWhere, date: { gte: new Date(Date.now() - 30 * MS_PER_DAY) } },
      _sum: { orderedQuantity: true },
    }),
    scope.runId === null ? 0 : horizonLength(where),
  ]);

  const forecastBy = new Map(forecast.map((row) => [row.warehouseId, row]));
  const historyBy = new Map(history.map((row) => [row.warehouseId, row._sum.orderedQuantity ?? 0]));

  return {
    ...emptyMeta(scope),
    items: warehouses.map((warehouse) => {
      const predicted = forecastBy.get(warehouse.id);
      const recent = historyBy.get(warehouse.id) ?? null;
      const forecastDemand = predicted ? round(predicted._sum.p50 ?? 0) : null;
      const days = horizonDays;

      return {
        warehouseId: warehouse.id,
        code: warehouse.code,
        name: warehouse.name,
        tier: warehouse.tier,
        region: warehouse.region,
        forecastDemand,
        forecastDays: days,
        recentDemand30d: recent === null ? null : round(recent),
        // How wide the model's own p10-p90 band is here, relative to the p50. The UI
        // used to print a literal "Conf: 0%" in this slot; this is the real figure it
        // never had.
        relativeBandWidth:
          predicted === null || predicted === undefined || !predicted._sum.p50
            ? null
            : round(((predicted._sum.p90 ?? 0) - (predicted._sum.p10 ?? 0)) / predicted._sum.p50),
        // Like for like: a horizon total against a 30-day trailing total would be
        // a growth number that mostly measures the difference in window length.
        growthPercent:
          forecastDemand === null || recent === null || recent === 0 || days === 0
            ? null
            : round((((forecastDemand / days) * 30 - recent) / recent) * 100),
      };
    }),
  };
};

export const getSkus = async (query: ForecastQuery, authScope?: { warehouseId?: string | null }) => {
  const scope = await resolveScope(query, authScope);
  const where = await withHorizon(scope, query.days);

  const [forecast, products, history, horizonDays] = await Promise.all([
    scope.runId === null ? [] : groupedForecast(where, "productId"),
    prisma.product.findMany({ select: { id: true, sku: true, name: true, category: true, criticality: true } }),
    // The trailing baseline the horizon is judged against. Without it the only
    // comparison available was the forecast's own mean, which is a tautology: every
    // SKU came out at exactly 0% growth and every trend read "stable".
    prisma.demandHistory.groupBy({
      by: ["productId"],
      where: { ...scope.historyWhere, date: { gte: new Date(Date.now() - 30 * MS_PER_DAY) } },
      _sum: { orderedQuantity: true },
    }),
    scope.runId === null ? 0 : horizonLength(where),
  ]);

  const productBy = new Map(products.map((product) => [product.id, product]));
  const historyBy = new Map(history.map((row) => [row.productId, row._sum.orderedQuantity ?? 0]));

  return {
    ...emptyMeta(scope),
    items: forecast
      .map((row) => {
        const product = productBy.get(row.productId);
        const total = round(row._sum.p50 ?? 0);
        const recent = historyBy.get(row.productId) ?? null;
        // Daily on both sides, so the comparison is not measuring window length.
        const recentDaily = recent === null ? null : round(recent / 30);
        const forecastDaily = horizonDays === 0 ? null : round(total / horizonDays);

        return {
          productId: row.productId,
          sku: product?.sku ?? null,
          name: product?.name ?? null,
          category: product?.category ?? null,
          criticality: product?.criticality ?? null,
          forecastDemand: total,
          forecastDays: horizonDays,
          averageDailyDemand: forecastDaily,
          recentDailyDemand30d: recentDaily,
          growthPercent:
            forecastDaily === null || recentDaily === null || recentDaily === 0
              ? null
              : round(((forecastDaily - recentDaily) / recentDaily) * 100),
        };
      })
      .sort((a, b) => b.forecastDemand - a.forecastDemand),
  };
};

/**
 * Accuracy for this scope, delegated to the single scorer.
 *
 * `forecast-accuracy.service.ts` owns the measurement so `/kpi`, `/performance`,
 * `/accuracy` and the dashboard KPI cannot report different numbers for the same run.
 */
const accuracyOf = async (scope: Scope) => {
  if (scope.runId === null) return metricsOf([]);

  const points = await loadScoredPoints(scope.runId, {
    ...(scope.productId === undefined ? {} : { productId: scope.productId }),
    ...(scope.warehouseId === undefined ? {} : { warehouseId: scope.warehouseId }),
  });
  return metricsOf(points);
};

interface PerformanceModel {
  modelVersion: string | null;
  isPrimary: boolean;
  /** Where the numbers come from: days this run got right, or the fit's holdout. */
  source: "realised" | "holdout";
  scoredPoints: number | null;
  accuracyPercent: number | null;
  wapePercent: number | null;
  mae: number | null;
  rmse: number | null;
  biasPercent: number | null;
}

const HOLDOUT_TTL_MS = 5 * 60_000;
let holdoutCache: { at: number; models: PerformanceModel[] } | null = null;

const scoreToModel = (
  modelVersion: string | null,
  isPrimary: boolean,
  scoredPoints: number | null,
  score: { MAE: number; RMSE: number; wMAPE_percent: number; bias_percent: number },
): PerformanceModel => ({
  modelVersion,
  isPrimary,
  source: "holdout",
  scoredPoints,
  accuracyPercent: round(Math.max(0, 100 - score.wMAPE_percent)),
  wapePercent: round(score.wMAPE_percent),
  mae: round(score.MAE),
  rmse: round(score.RMSE),
  biasPercent: round(score.bias_percent),
});

/**
 * The engine's own holdout, for a run that has nothing realised to score yet.
 *
 * These used to be six literals pasted into this file - the right numbers at the time,
 * frozen, so a retrain could not move them and nobody could tell they were stale. They
 * are read from the engine now, and an unreachable engine yields an empty list rather
 * than a remembered one: `source` tells the client which it is looking at.
 *
 * Cached because this sits behind a read route, and one slow engine must not become a
 * slow page. A failure is cached too, so a down engine costs one attempt per window.
 */
const holdoutModels = async (fallbackVersion: string | null): Promise<PerformanceModel[]> => {
  if (holdoutCache && Date.now() - holdoutCache.at < HOLDOUT_TTL_MS) return holdoutCache.models;

  let models: PerformanceModel[] = [];
  try {
    const metrics = modelMetricsSchema.parse(await fetchModelMetrics());
    const version = metrics.model_version ?? fallbackVersion;
    const points = metrics.test_rows ?? null;

    models = [scoreToModel(version, true, points, metrics.xgboost)];
    if (metrics.baseline_7_day_moving_average) {
      models.push(
        scoreToModel("Baseline (7-day MA)", false, points, metrics.baseline_7_day_moving_average),
      );
    }
  } catch (error) {
    console.warn("model metrics unavailable; reporting no performance rows", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  holdoutCache = { at: Date.now(), models };
  return models;
};

export const getPerformance = async (query: ForecastQuery, authScope?: { warehouseId?: string | null }) => {
  const scope = await resolveScope(query, authScope);
  const accuracy = await accuracyOf(scope);

  const realised = accuracy.scoredPoints > 0;
  const models: PerformanceModel[] =
    scope.runId === null
      ? []
      : realised
      ? [
          {
            modelVersion: scope.modelVersion,
            isPrimary: true,
            source: "realised",
            scoredPoints: accuracy.scoredPoints,
            accuracyPercent: accuracy.accuracyPercent,
            wapePercent: accuracy.wapePercent,
            mae: accuracy.maePerDay,
            rmse: accuracy.rmse ?? null,
            biasPercent: accuracy.biasPercent ?? null,
          },
        ]
      : await holdoutModels(scope.modelVersion);

  return {
    ...emptyMeta(scope),
    models,
    note: realised
      ? null
      : models.length === 0
      ? "No forecast day has been realised yet, and the engine's training metrics are unavailable."
      : "Measured on the training holdout, not on this run - no forecast day has been realised yet.",
  };
};

export const getImpact = async (query: ForecastQuery, authScope?: { warehouseId?: string | null }) => {
  const scope = await resolveScope(query, authScope);

  if (scope.runId === null) {
    return { ...emptyMeta(scope), totalCost: null, holdingCost: null, stockoutCost: null, transferCost: null, expiryCost: null, expectedWaste: null, serviceLevel: null, serviceLevelPercent: null };
  }

  const [optimization, simulation] = await Promise.all([
    prisma.optimizationResult.findUnique({ where: { planningRunId: scope.runId } }),
    prisma.simulationRun.findUnique({ where: { planningRunId: scope.runId } }),
  ]);

  return {
    ...emptyMeta(scope),
    totalCost: optimization?.totalCost ?? null,
    holdingCost: optimization?.holdingCost ?? null,
    stockoutCost: optimization?.stockoutCost ?? null,
    transferCost: optimization?.transferCost ?? null,
    expiryCost: optimization?.expiryCost ?? null,
    expectedWaste: simulation?.expectedWaste ?? null,
    serviceLevel: simulation?.serviceLevel ?? null,
    serviceLevelPercent:
      simulation?.serviceLevel === undefined ? null : round(simulation.serviceLevel * 100),
  };
};

/**
 * Derived observations, not prose.
 *
 * The route this replaces returned a written paragraph about flu trends that was
 * true of no particular dataset. These are facts with the numbers attached, so a
 * reader can check them.
 */
export const getInsight = async (query: ForecastQuery, authScope?: { warehouseId?: string | null }) => {
  const scope = await resolveScope(query, authScope);
  if (scope.runId === null) return { ...emptyMeta(scope), observations: [] };

  const [trend, network, accuracy] = await Promise.all([
    getTrend(query, authScope),
    getNetwork(query, authScope),
    accuracyOf(scope),
  ]);

  const observations: { kind: string; detail: string }[] = [];

  if (trend.thirtyDayTrend !== null) {
    observations.push({
      kind: "trend",
      detail: `Forecast demand over 30 days moves ${trend.thirtyDayTrend > 0 ? "up" : "down"} ${Math.abs(trend.thirtyDayTrend)}% against the first week`,
    });
  }

  const growing = network.items
    .filter((item) => item.growthPercent !== null)
    .sort((a, b) => (b.growthPercent ?? 0) - (a.growthPercent ?? 0))[0];

  if (growing) {
    observations.push({
      kind: "network",
      detail: `${growing.name} shows the largest change against its trailing 30 days at ${growing.growthPercent}%`,
    });
  }

  observations.push({
    kind: "accuracy",
    detail:
      accuracy.accuracyPercent === null
        ? "No forecast day has been realised yet, so accuracy is not measurable"
        : `Forecasts scored ${accuracy.accuracyPercent}% against realised demand over ${accuracy.scoredPoints} days`,
  });

  observations.push({
    kind: "uncertainty",
    detail: `The model's own band is ${trend.demandVolatility?.toLowerCase() ?? "unknown"} at ${trend.relativeBandWidth ?? "n/a"} of the median`,
  });

  return { ...emptyMeta(scope), observations };
};
