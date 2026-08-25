import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import { naiveForecast, type ForecastBand } from "../../src/utils/naive-forecast.js";

const flatHistory = (days: number, value: number) => Array.from({ length: days }, () => value);

// The weekday shape prisma/seed.ts generates, starting on a Sunday.
const WEEKDAY_MULTIPLIER = [0.55, 1.15, 1.1, 1.05, 1.05, 1.1, 0.6];

const seasonalHistory = (days: number, baseline: number) =>
  Array.from({ length: days }, (_unused, index) =>
    Math.round(baseline * WEEKDAY_MULTIPLIER[index % 7]!),
  );

const assertWellFormed = (bands: ForecastBand[]) => {
  for (const [index, band] of bands.entries()) {
    assert.ok(Number.isFinite(band.p10), "p10 not finite at " + index);
    assert.ok(Number.isFinite(band.p50), "p50 not finite at " + index);
    assert.ok(Number.isFinite(band.p90), "p90 not finite at " + index);
    assert.ok(band.p10 >= 0, "negative p10 at " + index + ": " + band.p10);
    assert.ok(band.p10 <= band.p50, "p10 above p50 at " + index);
    assert.ok(band.p50 <= band.p90, "p50 above p90 at " + index);
  }
};

describe("naiveForecast", () => {
  test("returns exactly one band per requested day", () => {
    const bands = naiveForecast({ history: flatHistory(180, 100), horizonDays: 30 });
    assert.equal(bands.length, 30);
    assertWellFormed(bands);
  });

  test("orders the band and never goes negative, across many shapes", () => {
    const shapes = [
      flatHistory(180, 100),
      seasonalHistory(180, 200),
      flatHistory(180, 0),
      [0, 0, 0, 500, 0, 0, 0],
      flatHistory(3, 7),
      seasonalHistory(84, 1),
    ];

    for (const history of shapes) {
      assertWellFormed(naiveForecast({ history, horizonDays: 30 }));
    }
  });

  test("steady demand forecasts that same level", () => {
    const [band] = naiveForecast({ history: flatHistory(180, 120), horizonDays: 1 });

    assert.ok(band);
    assert.ok(Math.abs(band.p50 - 120) < 1e-6, "expected 120, got " + band.p50);
  });

  test("steady demand has no residual spread, so the band collapses", () => {
    const [band] = naiveForecast({ history: flatHistory(180, 120), horizonDays: 1 });

    assert.ok(band);
    assert.ok(Math.abs(band.p90 - band.p50) < 1e-6, "a perfect fit should carry no uncertainty");
    assert.ok(Math.abs(band.p50 - band.p10) < 1e-6);
  });

  test("recovers the weekday shape the seed generates", () => {
    const bands = naiveForecast({
      history: seasonalHistory(168, 200),
      horizonDays: 7,
      historyStartDayOfWeek: 0,
    });

    // 168 days is a whole number of weeks, so day 168 is a Sunday again - the trough.
    const medians = bands.map((band) => band.p50);
    const sunday = medians[0]!;
    const monday = medians[1]!;

    assert.ok(monday > sunday, "Monday demand should exceed Sunday: " + monday + " vs " + sunday);
    assert.ok(
      Math.abs(monday / sunday - WEEKDAY_MULTIPLIER[1]! / WEEKDAY_MULTIPLIER[0]!) < 0.05,
      "the weekday ratio was not recovered",
    );
  });

  test("a noisier history produces a wider band", () => {
    const steady = naiveForecast({ history: flatHistory(180, 100), horizonDays: 1 })[0]!;

    const noisy = naiveForecast({
      history: Array.from({ length: 180 }, (_unused, index) => (index % 2 === 0 ? 40 : 160)),
      horizonDays: 1,
    })[0]!;

    assert.ok(
      noisy.p90 - noisy.p10 > steady.p90 - steady.p10,
      "uncertainty must reflect how badly the fit missed",
    );
  });

  test("an empty history forecasts zero rather than guessing", () => {
    const bands = naiveForecast({ history: [], horizonDays: 5 });

    assert.equal(bands.length, 5);
    for (const band of bands) assert.deepEqual(band, { p10: 0, p50: 0, p90: 0 });
  });

  test("a horizon of zero or less is an empty forecast", () => {
    assert.deepEqual(naiveForecast({ history: flatHistory(90, 10), horizonDays: 0 }), []);
    assert.deepEqual(naiveForecast({ history: flatHistory(90, 10), horizonDays: -5 }), []);
  });

  test("all-zero demand stays at zero", () => {
    const bands = naiveForecast({ history: flatHistory(180, 0), horizonDays: 10 });

    for (const band of bands) assert.deepEqual(band, { p10: 0, p50: 0, p90: 0 });
  });

  test("handles a history shorter than its own windows", () => {
    assertWellFormed(naiveForecast({ history: [5, 9, 4], horizonDays: 14 }));
    assertWellFormed(naiveForecast({ history: [42], horizonDays: 3 }));
  });

  test("tracks the recent level, not the whole history", () => {
    // Demand steps up in the last four weeks; the 28-day level should follow it.
    const history = [...flatHistory(150, 50), ...flatHistory(28, 200)];
    const [band] = naiveForecast({ history, horizonDays: 1 });

    assert.ok(band);
    assert.ok(band.p50 > 150, "the forecast ignored a recent step change: " + band.p50);
  });

  test("is deterministic", () => {
    const history = seasonalHistory(180, 130);
    const first = naiveForecast({ history, horizonDays: 30 });
    const second = naiveForecast({ history, horizonDays: 30 });

    assert.deepEqual(first, second);
  });
});
