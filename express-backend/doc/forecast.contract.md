# Forecast service contract

The wire contract between the Express backend and the Python forecasting service. Written before either side, so WP-06 and WP-07 can be built in parallel against it.

This is **not** a route in this API. The forecasting service is an outbound dependency, like Postgres and Redis — the frontend never reaches it, and it is not published outside the compose network.

## Shape

```
                POST /forecast  { runId, horizonDays, asOf, pairs[] }
Express :4000  ─────────────────────────────────────────────>  Python :8000
      ^                                                              |
      |         GET /api/training-data  (NDJSON, ~6.4 MB)            |
      +──────────────────────────────────────────────────────────────+
      |
      +──> writes Forecast rows via Prisma
```

**Python pulls its own history.** The request carries identifiers only — no series, no signals, no promotions. Python reads what it needs from [`GET /api/training-data`](training.api.md), the same endpoint it trains on, so the features a model is fitted against are the features it later predicts against.

**Python never touches Postgres.** Prisma stays the only owner of the schema, and a migration cannot silently break the engine.

**Express writes every row.** Python returns forecasts in its response body and persists nothing.

---

## `POST {FORECAST_SERVICE_URL}/forecast`

### Request

```json
{
  "runId": "cmt8qicnn00004wjdw3mltjh6",
  "horizonDays": 30,
  "asOf": "2026-08-25",
  "pairs": [
    { "productId": "cmt6kuign000574jdlxf1lsg8", "warehouseId": "cmt6kui8o000174jduxbwkuug" }
  ]
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `runId` | string | The `PlanningRun` this forecast belongs to. Echoed in logs; Python does not read the database with it |
| `horizonDays` | integer | 1–365. Every returned array must be exactly this long |
| `asOf` | `YYYY-MM-DD` | The forecast origin. Day 0 of the horizon is **`asOf + 1`** |
| `pairs` | array | Which series to forecast. Node sends the pairs that hold an inventory position — not every pair with history |

`pairs` is explicit rather than inferred. `/api/training-data` returns every pair that has demand history, which is not necessarily the set Node needs planned.

**Scenario multipliers are not sent.** `demandMultiplier` is applied in Node after the response lands, so Python stays a pure forecaster and one forecast can be re-scored under several scenarios without refitting.

### Response `200`

```json
{
  "modelVersion": "xgb-quantile-0.1.0",
  "generatedAt": "2026-08-25T09:12:44.183Z",
  "horizonDays": 30,
  "forecasts": [
    {
      "productId": "cmt6kuign000574jdlxf1lsg8",
      "warehouseId": "cmt6kui8o000174jduxbwkuug",
      "start": "2026-08-26",
      "p10": [82.1, 79.4, "... 30 values"],
      "p50": [104.6, 101.2, "..."],
      "p90": [131.8, 128.0, "..."]
    }
  ]
}
```

**Dense parallel arrays, not `[{date, value}]`.** One value per day with no gaps, which makes the "no missing days" invariant structural rather than something the reader has to check. `start` plus the index gives the date.

| Field | Type | Notes |
| --- | --- | --- |
| `modelVersion` | string | Written to `Forecast.modelVersion`. Identifies which model produced the row |
| `generatedAt` | ISO instant | |
| `horizonDays` | integer | Must equal the request |
| `start` | `YYYY-MM-DD` | Must equal `asOf + 1` |
| `p10` / `p50` / `p90` | number[] | Length exactly `horizonDays` |

### Validation Node enforces

WP-07 rejects the **entire response** if any of these fail. A partially-good forecast is not salvaged: a silently wrong band poisons safety stock, which poisons every downstream artefact.

- Every array length === `horizonDays`
- `p10[i] <= p50[i] <= p90[i]` at every index
- Every value finite and `>= 0`
- Exactly one entry per requested pair — no missing pairs, no extras, no duplicates
- `start` === `asOf + 1`

### Errors

Python answers a non-2xx with:

```json
{ "error": { "code": "TRAINING_DATA_UNAVAILABLE", "message": "..." } }
```

| Status | When |
| --- | --- |
| `422` | The request did not validate |
| `502` | `/api/training-data` was unreachable or returned an error |
| `500` | The fit or prediction failed |

Node retries on network errors, `5xx` and `429` only — **never** on a `4xx`, which will fail identically on retry. `FORECAST_RETRIES` defaults to 2, so three attempts.

On final failure Node either falls back to `utils/naive-forecast.ts` (`FORECAST_FALLBACK=true`, the default) or fails the run with `failureStage: "forecast"`.

---

## `GET {FORECAST_SERVICE_URL}/health`

`200` when the process is up and can reach `/api/training-data`; non-2xx otherwise. Feeds the `forecast` dependency in `/api/health/ready`.

**It reports `not_configured`, not `down`, when `FORECAST_SERVICE_URL` is unset** — otherwise the Docker `HEALTHCHECK` starts failing a container that is serving every route it can.

---

## Reading `/api/training-data`

Two rules Python must follow. Both are in [`training.api.md`](training.api.md); they are repeated here because ignoring either produces a model that trains on bad data and reports success.

**Check `x-training-rows`.** A stream cut short by a timeout is still syntactically valid NDJSON. Comparing the header to the number of rows parsed is the only way to detect truncation.

**Fit on `demand`, never `fulfilled`.** `demand` is `orderedQuantity`, the uncensored signal. `fulfilled` is capped by what was in stock, so fitting it teaches the model that a stockout was a quiet day. `stockout` and `fulfilled` are there as *features*, so the model can tell the two apart.

### The rate limit is the real constraint

`/api/training-data` is on the **`expensive` tier: 10 requests per rolling hour**. Every forecast attempt pulls it once, and `FORECAST_RETRIES=2` means one failing run can burn three.

Two consequences:

- **Allowlist the engine.** `RATE_LIMIT_ALLOWLIST` already exists in `src/config/constants.ts` and the limiter skips allowlisted addresses. Put the engine container's address in it, or a handful of retries locks out the planner.
- **Pull once per request, not per pair.** One unfiltered export covers every series. Pulling per pair would be 160 requests against a limit of 10.

### Timeout budget

`FORECAST_TIMEOUT_MS` (default 60s) must cover the training-data pull **plus** fit and predict. The pull alone is ~2s for 28,800 rows. `/api/training-data` itself is capped by `SERVER.requestTimeoutMs` (30s), roughly 440,000 rows — past that Python must window on `from`/`to` and concatenate.

---

## Python configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `API_BASE_URL` | — | e.g. `http://backend:4000/api`. Where `/training-data` lives |
| `ENGINE_PORT` | `8000` | |
| `ENGINE_MAX_HORIZON_DAYS` | `180` | Clamp. Only 180 days of history exist, so a 365-day horizon has no annual seasonality to learn |

**The dependency now points both ways** — Express calls the engine, the engine calls Express. Do **not** make `backend` and `engine` both `depends_on: condition: service_healthy` in compose, or boot deadlocks. Express degrades to the naive fallback without the engine, so only the engine should wait.
