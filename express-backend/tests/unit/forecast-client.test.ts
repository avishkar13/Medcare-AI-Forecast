import { strict as assert } from "node:assert";
import { afterEach, describe, test } from "node:test";
import { forecastViolations, type ForecastRequest } from "../../src/zod/forecast.schemas.js";

const pair = { productId: "p1", warehouseId: "w1" };

const request: ForecastRequest = {
  runId: "run-1",
  horizonDays: 3,
  asOf: "2026-08-25",
  pairs: [pair],
};

const START = "2026-08-26";

const series = (overrides: Partial<Record<"p10" | "p50" | "p90", number[]>> = {}) => ({
  ...pair,
  start: START,
  p10: overrides.p10 ?? [1, 2, 3],
  p50: overrides.p50 ?? [2, 3, 4],
  p90: overrides.p90 ?? [3, 4, 5],
});

const response = (forecasts: ReturnType<typeof series>[], horizonDays = 3) => ({
  modelVersion: "test-1",
  generatedAt: "2026-08-25T00:00:00.000Z",
  horizonDays,
  forecasts,
});

describe("forecastViolations", () => {
  test("accepts a well-formed response", () => {
    assert.deepEqual(forecastViolations(response([series()]), request, START), []);
  });

  test("rejects an array shorter than the horizon", () => {
    const problems = forecastViolations(response([series({ p50: [2, 3] })]), request, START);
    assert.ok(problems.some((problem) => problem.includes("p50 has 2 values")));
  });

  test("rejects a band out of order", () => {
    const problems = forecastViolations(response([series({ p50: [9, 3, 4] })]), request, START);
    assert.ok(problems.some((problem) => problem.includes("band out of order at day 0")));
  });

  test("rejects a start date that is not asOf + 1", () => {
    const drifted = { ...series(), start: "2026-08-27" };
    const problems = forecastViolations(response([drifted]), request, START);
    assert.ok(problems.some((problem) => problem.includes("is not asOf + 1")));
  });

  test("rejects a horizon that disagrees with the request", () => {
    const problems = forecastViolations(response([series()], 7), request, START);
    assert.ok(problems.some((problem) => problem.includes("horizonDays 7")));
  });

  test("rejects a missing pair", () => {
    const twoPairs = { ...request, pairs: [pair, { productId: "p2", warehouseId: "w1" }] };
    const problems = forecastViolations(response([series()]), twoPairs, START);
    assert.ok(problems.some((problem) => problem.includes("missing forecast for p2:w1")));
  });

  test("rejects a pair nobody asked for", () => {
    const extra = { ...series(), productId: "p9" };
    const problems = forecastViolations(response([series(), extra]), request, START);
    assert.ok(problems.some((problem) => problem.includes("unrequested forecast for p9:w1")));
  });

  test("rejects a duplicated pair", () => {
    const problems = forecastViolations(response([series(), series()]), request, START);
    assert.ok(problems.some((problem) => problem.includes("duplicate forecast")));
  });

  test("a band that touches at every point is still in order", () => {
    const flat = series({ p10: [2, 3, 4], p50: [2, 3, 4], p90: [2, 3, 4] });
    assert.deepEqual(forecastViolations(response([flat]), request, START), []);
  });
});

// The client reads FORECAST at module scope, so the service url has to be set
// before it is imported. Each case installs its own fetch and restores it after.
const withService = async (
  handler: (input: string | URL | Request, init?: RequestInit) => Promise<Response>,
) => {
  process.env.FORECAST_SERVICE_URL = "http://engine.test";
  process.env.FORECAST_RETRIES = "2";
  globalThis.fetch = handler as typeof fetch;
  return import("../../src/lib/forecast-client.js");
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("requestForecast", () => {
  test("retries a 500 and succeeds on the second attempt", async () => {
    let calls = 0;
    const { requestForecast } = await withService(async () => {
      calls += 1;
      return calls === 1 ? jsonResponse({}, 500) : jsonResponse(response([series()]));
    });

    const result = await requestForecast(request);
    assert.equal(result.modelVersion, "test-1");
    assert.equal(calls, 2, "a 5xx should be retried");
  });

  test("does not retry a 4xx", async () => {
    let calls = 0;
    const { requestForecast, ForecastServiceError } = await withService(async () => {
      calls += 1;
      return jsonResponse({ error: { code: "BAD" } }, 422);
    });

    await assert.rejects(() => requestForecast(request), ForecastServiceError);
    assert.equal(calls, 1, "a 4xx fails identically on retry, so it must not be repeated");
  });

  test("does not retry a malformed body", async () => {
    let calls = 0;
    const { requestForecast } = await withService(async () => {
      calls += 1;
      return jsonResponse({ modelVersion: "x" });
    });

    await assert.rejects(() => requestForecast(request), /malformed/);
    assert.equal(calls, 1, "a bad body is not a transport problem");
  });

  test("rejects a response whose band is out of order", async () => {
    const { requestForecast } = await withService(async () =>
      jsonResponse(response([series({ p50: [99, 3, 4] })])),
    );

    await assert.rejects(() => requestForecast(request), /failed validation/);
  });

  test("gives up after the configured number of retries", async () => {
    let calls = 0;
    const { requestForecast } = await withService(async () => {
      calls += 1;
      throw new Error("connect ECONNREFUSED");
    });

    await assert.rejects(() => requestForecast(request), /ECONNREFUSED/);
    assert.equal(calls, 3, "one attempt plus FORECAST_RETRIES");
  });
});
