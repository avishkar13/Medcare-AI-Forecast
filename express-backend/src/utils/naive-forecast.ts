import { zScore } from "./inventory.js";

export interface NaiveForecastInput {
  history: number[];
  horizonDays: number;
  historyStartDayOfWeek?: number;
}

export interface ForecastBand {
  p10: number;
  p50: number;
  p90: number;
}

const DAYS_IN_WEEK = 7;
const LEVEL_WINDOW_DAYS = 28;
const SEASONAL_WINDOW_DAYS = 84;

// z(0.9). The band is symmetric, so z(0.1) is its negation.
const BAND_Z = zScore(0.9);

const mean = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;

const sampleStdDev = (values: number[]): number => {
  if (values.length < 2) return 0;
  const average = mean(values);
  const variance =
    values.reduce((total, value) => total + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
};

// Mean demand per weekday over the window, expressed as a ratio of the window mean.
// A weekday never observed keeps a factor of 1 rather than collapsing to zero.
const weekdayFactors = (history: number[], startDayOfWeek: number): number[] => {
  const window = history.slice(-SEASONAL_WINDOW_DAYS);
  const offset = startDayOfWeek + Math.max(0, history.length - window.length);
  const overall = mean(window);

  const buckets: number[][] = Array.from({ length: DAYS_IN_WEEK }, () => []);
  for (const [index, value] of window.entries()) {
    buckets[(offset + index) % DAYS_IN_WEEK]!.push(value);
  }

  if (overall <= 0) return buckets.map(() => 1);

  return buckets.map((bucket) => (bucket.length === 0 ? 1 : mean(bucket) / overall));
};

/**
 * Seasonal-naive forecast: a 28-day level scaled by a weekday index, with the band
 * taken from how far that fit missed on the history it was built from.
 *
 * This is the reference the Python model is checked against, and the only forecast
 * available when no forecasting service is configured.
 */
export const naiveForecast = ({
  history,
  horizonDays,
  historyStartDayOfWeek = 0,
}: NaiveForecastInput): ForecastBand[] => {
  if (horizonDays <= 0) return [];

  const flat: ForecastBand = { p10: 0, p50: 0, p90: 0 };
  if (history.length === 0) return Array.from({ length: horizonDays }, () => ({ ...flat }));

  const level = mean(history.slice(-LEVEL_WINDOW_DAYS));
  const factors = weekdayFactors(history, historyStartDayOfWeek);

  const fittedFor = (index: number) =>
    level * factors[(historyStartDayOfWeek + index) % DAYS_IN_WEEK]!;

  const residuals = history
    .slice(-SEASONAL_WINDOW_DAYS)
    .map((value, index) => value - fittedFor(history.length - Math.min(history.length, SEASONAL_WINDOW_DAYS) + index));

  const spread = BAND_Z * sampleStdDev(residuals);

  return Array.from({ length: horizonDays }, (_unused, step) => {
    const median = Math.max(0, fittedFor(history.length + step));
    return {
      p10: Math.max(0, median - spread),
      p50: median,
      p90: median + spread,
    };
  });
};
