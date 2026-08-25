import { FORECAST } from "../config/constants.js";
import { prisma } from "../config/prisma.js";
import { ForecastServiceError, requestForecast } from "../lib/forecast-client.js";
import { naiveForecast } from "../utils/naive-forecast.js";
import type { ForecastPair } from "../zod/forecast.schemas.js";
import type { ForecastPointBand, ForecastResult } from "../types.js";

const HISTORY_DAYS = 180;
const MS_PER_DAY = 86_400_000;

const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const pairKey = (pair: ForecastPair) => `${pair.productId}:${pair.warehouseId}`;

export interface ForecastRequestInput {
  runId: string;
  horizonDays: number;
  asOf: Date;
  pairs: ForecastPair[];
}

/**
 * Daily demand per pair, dense - one value per day with no gaps, oldest first.
 *
 * Only the fallback needs this. When a forecasting service is configured it pulls
 * its own history from `/api/training-data`, so the Python path never loads it.
 */
const loadHistories = async (
  pairs: ForecastPair[],
  asOf: Date,
): Promise<Map<string, { values: number[]; startDayOfWeek: number }>> => {
  const start = new Date(asOf.getTime() - (HISTORY_DAYS - 1) * MS_PER_DAY);

  const rows = await prisma.demandHistory.groupBy({
    by: ["productId", "warehouseId", "date"],
    where: { date: { gte: start, lte: asOf } },
    _sum: { orderedQuantity: true },
  });

  const observed = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const key = `${row.productId}:${row.warehouseId}`;
    const byDay = observed.get(key) ?? new Map<string, number>();
    byDay.set(isoDay(row.date), row._sum.orderedQuantity ?? 0);
    observed.set(key, byDay);
  }

  const histories = new Map<string, { values: number[]; startDayOfWeek: number }>();

  for (const pair of pairs) {
    const byDay = observed.get(pairKey(pair));
    const values: number[] = [];

    for (let offset = 0; offset < HISTORY_DAYS; offset += 1) {
      const day = isoDay(new Date(start.getTime() + offset * MS_PER_DAY));
      values.push(byDay?.get(day) ?? 0);
    }

    histories.set(pairKey(pair), { values, startDayOfWeek: start.getUTCDay() });
  }

  return histories;
};

const fallbackForecast = async (input: ForecastRequestInput): Promise<ForecastResult> => {
  const histories = await loadHistories(input.pairs, input.asOf);

  const series = input.pairs.map((pair) => {
    const history = histories.get(pairKey(pair)) ?? { values: [], startDayOfWeek: 0 };
    const bands = naiveForecast({
      history: history.values,
      horizonDays: input.horizonDays,
      historyStartDayOfWeek: history.startDayOfWeek,
    });

    return { ...pair, points: bands as ForecastPointBand[] };
  });

  return { origin: "fallback", modelVersion: FORECAST.fallbackModelVersion, series };
};

/**
 * The seam. Python when it is configured and answers, the naive forecast otherwise.
 *
 * Callers get one shape either way and learn which path ran from `origin`, which is
 * also what lands in `Forecast.modelVersion`.
 */
export const forecastDemand = async (input: ForecastRequestInput): Promise<ForecastResult> => {
  if (!FORECAST.serviceUrl) return fallbackForecast(input);

  try {
    const response = await requestForecast({
      runId: input.runId,
      horizonDays: input.horizonDays,
      asOf: isoDay(input.asOf),
      pairs: input.pairs,
    });

    const series = response.forecasts.map((forecast) => ({
      productId: forecast.productId,
      warehouseId: forecast.warehouseId,
      points: forecast.p50.map((p50, index) => ({
        p10: forecast.p10[index]!,
        p50,
        p90: forecast.p90[index]!,
      })),
    }));

    return { origin: "python", modelVersion: response.modelVersion, series };
  } catch (error) {
    if (!FORECAST.fallbackEnabled) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new ForecastServiceError(`forecast unavailable and fallback disabled: ${reason}`, {
        cause: error,
      });
    }

    console.warn("falling back to the naive forecast", {
      reason: error instanceof Error ? error.message : String(error),
    });
    return fallbackForecast(input);
  }
};
