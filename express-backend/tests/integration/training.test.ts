import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";
import { app, teardown } from "../helpers/app.js";
import { startServer, type TestServer } from "../helpers/server.js";
import { expectErrorShape } from "../helpers/assertions.js";

let server: TestServer;

before(async () => {
  server = await startServer(app);
});

after(async () => {
  await server.close();
  await teardown();
});

interface TrainingRow {
  date: string;
  sku: string;
  productId: string;
  dc: string;
  warehouseId: string;
  demand: number;
  fulfilled: number | null;
  stockout: boolean;
  promotion: boolean;
  holiday: boolean;
  season: string | null;
  region: string | null;
  promotionUplift: number | null;
  promotionType: string | null;
  demandSignalType: string | null;
  demandSignalValue: number | null;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

interface TrailerRow {
  _type: "future_signal" | "future_promotion";
}

/**
 * The stream carries three segments. History rows have no `_type`; the trailers tag
 * themselves. `x-training-rows` counts history only, so the trailers are split off
 * here rather than being counted as demand.
 */
const fetchRows = async (
  path: string,
): Promise<{ rows: TrainingRow[]; trailers: TrailerRow[]; response: Response }> => {
  const response = await server.get(path);
  const body = await response.text();
  const parsed = body
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as TrainingRow | TrailerRow);

  return {
    rows: parsed.filter((row) => !("_type" in row)) as TrainingRow[],
    trailers: parsed.filter((row) => "_type" in row) as TrailerRow[],
    response,
  };
};

describe("GET /api/training-data", () => {
  test("streams newline-delimited rows with the advertised count", async () => {
    const { rows, response } = await fetchRows("/api/training-data");

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /application\/x-ndjson/);
    assert.ok(rows.length > 0, "expected demand history rows");
    assert.equal(Number(response.headers.get("x-training-rows")), rows.length);
  });

  test("every row carries the full feature shape", async () => {
    const { rows } = await fetchRows("/api/training-data");

    for (const row of rows) {
      assert.match(row.date, ISO_DAY);
      assert.equal(typeof row.sku, "string");
      assert.equal(typeof row.productId, "string");
      assert.equal(typeof row.dc, "string");
      assert.equal(typeof row.warehouseId, "string");
      assert.equal(typeof row.demand, "number");
      assert.ok(row.fulfilled === null || typeof row.fulfilled === "number");
      assert.equal(typeof row.stockout, "boolean");
      assert.equal(typeof row.promotion, "boolean");
      assert.equal(typeof row.holiday, "boolean");
      assert.ok(row.season === null || typeof row.season === "string");
    }
  });

  test("rows are grouped by series and ordered by date within a series", async () => {
    const { rows } = await fetchRows("/api/training-data");
    const seen = new Set<string>();
    let current = "";
    let previousDate = "";

    for (const row of rows) {
      const key = `${row.productId}:${row.warehouseId}`;

      if (key !== current) {
        assert.ok(!seen.has(key), `series ${key} is not contiguous`);
        seen.add(key);
        current = key;
        previousDate = "";
      }

      assert.ok(previousDate <= row.date, `dates out of order in ${key}`);
      previousDate = row.date;
    }
  });

  test("no duplicate rows per series and date", async () => {
    const { rows } = await fetchRows("/api/training-data");
    const keys = new Set(rows.map((row) => `${row.productId}:${row.warehouseId}:${row.date}`));
    assert.equal(keys.size, rows.length);
  });

  test("filters by sku and by warehouse code", async () => {
    const { rows: all } = await fetchRows("/api/training-data");
    const sample = all[0]!;

    const { rows: bySku } = await fetchRows(`/api/training-data?sku=${sample.sku}`);
    assert.ok(bySku.length > 0);
    assert.ok(bySku.every((row) => row.sku === sample.sku));

    const { rows: byDc } = await fetchRows(`/api/training-data?warehouse=${sample.dc}`);
    assert.ok(byDc.length > 0);
    assert.ok(byDc.every((row) => row.dc === sample.dc));
  });

  test("each segment matches its own count header", async () => {
    const { rows, trailers, response } = await fetchRows("/api/training-data");

    const signals = trailers.filter((row) => row._type === "future_signal");
    const promotions = trailers.filter((row) => row._type === "future_promotion");

    // Three counts, three headers. One grand total would let a truncation inside
    // history hide behind a trailer that never arrived.
    assert.equal(Number(response.headers.get("x-training-rows")), rows.length);
    assert.equal(Number(response.headers.get("x-future-signals")), signals.length);
    assert.equal(Number(response.headers.get("x-future-promotions")), promotions.length);
  });

  test("the forecast horizon gets forward-dated signals, not just history", async () => {
    const { rows, trailers } = await fetchRows("/api/training-data");
    const signals = trailers.filter((row) => row._type === "future_signal") as unknown as {
      date: string;
      region: string | null;
      value: number;
    }[];

    assert.ok(signals.length > 0, "a leading indicator with no future values cannot lead");

    // Every one must be past the last day of history, or it is not forward-looking.
    const lastHistoryDay = rows.reduce((latest, row) => (row.date > latest ? row.date : latest), "");
    for (const signal of signals) {
      assert.ok(
        signal.date > lastHistoryDay,
        `signal dated ${signal.date} is not after history's last day ${lastHistoryDay}`,
      );
      assert.ok(Number.isFinite(signal.value));
    }

    // Regional, not national: collapsing the regions would drop the only variation
    // that distinguishes a surge in one part of the network from a quiet one.
    assert.ok(
      new Set(signals.map((signal) => signal.region)).size > 1,
      "expected one signal series per region",
    );
  });

  test("history rows carry the region their signal is keyed by", async () => {
    const { rows } = await fetchRows("/api/training-data?sku=SKU-AMX-500");

    for (const row of rows.slice(0, 50)) {
      assert.ok(row.region, "without a region a consumer cannot match forward-dated signals");
      assert.equal(typeof row.demandSignalValue, "number");
    }
  });

  test("filters by date window inclusively", async () => {
    const { rows: all } = await fetchRows("/api/training-data");
    const dates = [...new Set(all.map((row) => row.date))].sort();
    const from = dates[1]!;
    const to = dates[3]!;

    const { rows } = await fetchRows(`/api/training-data?from=${from}&to=${to}`);

    assert.ok(rows.length > 0);
    assert.ok(rows.every((row) => row.date >= from && row.date <= to));
    assert.ok(rows.some((row) => row.date === from));
    assert.ok(rows.some((row) => row.date === to));
  });

  test("rejects an inverted date window", async () => {
    const response = await server.get("/api/training-data?from=2026-06-01&to=2026-01-01");
    assert.equal(response.status, 422);
    expectErrorShape(await response.json(), "VALIDATION_FAILED");
  });

  test("404s an unknown sku rather than streaming an empty body", async () => {
    const response = await server.get("/api/training-data?sku=SKU-DOES-NOT-EXIST");
    assert.equal(response.status, 404);
    expectErrorShape(await response.json(), "NOT_FOUND");
  });
});
