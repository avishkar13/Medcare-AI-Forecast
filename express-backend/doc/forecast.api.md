# Forecast API

Mounted at `/api/forecast` (`src/routes/forecast_route.ts`). Eleven `GET` routes, all on the `read` tier.

Shared conventions — response envelope, error codes, headers and rate limits — are in [`conventions.api.md`](conventions.api.md) and not repeated here.

This is the **read side** of forecasting. It serves what a completed [planning run](planning.api.md) predicted. It does not produce forecasts — the engine does that, over [`forecast.contract.md`](forecast.contract.md), and the executor persists the rows.

---

## Every figure is attributable

Each response carries `planningRunId` and `modelVersion`: which run produced these numbers and which model produced that run's forecast.

**When no run has completed, every derived figure is `null` and `planningRunId` is `null`.** Nothing is defaulted, estimated, or filled with a plausible constant. A dashboard showing an invented accuracy is worse than one showing none, because nobody goes looking for the bug.

History-only routes (`main-chart`'s history half, `seasonality`) still answer from `DemandHistory`, because they do not depend on a run.

## Shared query parameters

| Parameter | Type | Notes |
| --- | --- | --- |
| `runId` | string | Defaults to the most recent `COMPLETED` run. An unknown id is `404`; a run that exists but never completed is treated as no run |
| `sku` | string | Product **cuid** or `sku`. Unknown is `404` |
| `warehouse` | string | Warehouse **cuid** or `code`. Unknown is `404` |
| `days` | integer 1–365 | Trim to the first N days of the horizon |

`main-chart` adds `historyDays` (integer 0–365, default `60`).

---

## The routes

| Route | Returns |
| --- | --- |
| `GET /kpi` | `forecastedDemand`, `forecastHorizonDays`, `expectedPeakDemand`, `peakDate`, `averageDailyDemand`, `forecastAccuracy` |
| `GET /summary` | `averageDailyDemand`, min/max, `confidenceRange`, `expectedTrend`, `trendChangePercent` |
| `GET /main-chart` | `history[{date, actualDemand}]` and `prediction[{date, predictedDemand, lowerBound, upperBound}]` |
| `GET /trend` | `sevenDayTrend`, `thirtyDayTrend`, `relativeBandWidth`, `demandVolatility` |
| `GET /seasonality` | `weeklyPattern`, `monthlyPattern`, `seasonalUpliftPercent` |
| `GET /network` | Per warehouse: `forecastDemand`, `forecastDays`, `recentDemand30d`, `growthPercent` |
| `GET /skus` | Per product: `forecastDemand`, `forecastDays`, `averageDailyDemand`, ordered by demand |
| `GET /performance` | Real accuracy of this run's forecasts against realised demand |
| `GET /impact` | The run's own `OptimizationResult` and `SimulationRun` figures |
| `GET /insight` | Derived observations, each with its numbers |
| `GET /accuracy` | Scored error against realised demand, overall or by sku / warehouse / horizon |

### Two decisions worth knowing

**`history` and `prediction` are separate arrays**, not one series with nulls. They do not overlap in time, and merging them invites a chart to imply they do.

**`confidenceRange` is the model's own `p10`/`p90` band**, averaged over the horizon — not an interval computed here.

---

## `GET /performance`

Scores this run's `Forecast.p50` against realised `DemandHistory`, for the forecast days that have actually happened.

```json
{
  "data": {
    "planningRunId": "cmt9...",
    "modelVersion": "medcare-xgb-qrf-v1",
    "models": [
      { "modelVersion": "medcare-xgb-qrf-v1", "isPrimary": true, "source": "realised",
        "scoredPoints": 640, "accuracyPercent": 89.4, "wapePercent": 10.6,
        "mae": 5.2, "rmse": 7.4, "biasPercent": 1.8 }
    ],
    "note": null
  }
}
```

**Accuracy is `100 − WAPE`, weighted by volume** — not the mean of per-row percentages. A single near-zero actual would otherwise dominate the average and report a figure nobody would believe.

### `source` says what you are looking at

**A fresh run forecasts only the future, so it has nothing to score.** Rather than an empty table, the route then falls back to the engine's own training holdout, fetched live from `GET /model/metrics`: the XGBoost fit as the primary row and the 7-day moving average as a baseline to read it against. Those rows carry `source: "holdout"` and a `note` saying they were not measured on this run.

| `source` | Meaning |
| --- | --- |
| `realised` | This run's forecasts scored against demand that actually happened |
| `holdout` | The last fit's test split, from the engine. Not this run, not this data |

**The distinction is a field, not a sentence**, because a client that ignores prose will still not mistake one for the other.

These numbers were once six literals in `forecastread.service.ts` — correct when they were pasted, then frozen, so a retrain could not move them and nothing on screen revealed they were stale. If the engine is unreachable or has never been trained, `models` is empty and `note` says so. **A remembered number is not served in place of a missing one.**

---

## `GET /accuracy`

WP-19. Scores a past run's `Forecast.p50` against realised `DemandHistory`, and is the read behind `DashboardKPIs.forecastAccuracy`.

| Parameter | Values | Notes |
| --- | --- | --- |
| `runId` | string | Defaults to the most recent completed run **that has a realised day**, not simply the latest |
| `sku`, `warehouse` | string | cuid or code |
| `groupBy` | `overall` \| `sku` \| `warehouse` \| `horizon` | Default `overall` |

```json
{ "data": {
  "planningRunId": "cmt9...", "modelVersion": "medcare-xgb-qrf-v1",
  "horizonDays": 30, "groupBy": "horizon",
  "overall": { "scoredPoints": 640, "accuracyPercent": 89.4, "wapePercent": 10.6,
               "mapePercent": 12.1, "mapeExcludedPoints": 3,
               "maePerDay": 5.2, "rmse": 7.4, "biasPercent": -3.6 },
  "groups": [ { "horizonDay": 1, "scoredPoints": 160, "wapePercent": 9.8, "...": "" } ],
  "note": null,
  "dataCaveat": "Seeded demand is generated, so these figures measure how well the model recovers a known formula, not forecast skill on real data"
} }
```

### Read WAPE, not MAPE

`wapePercent` is `Σ|error| / Σactual` — one division, by the total. `mapePercent` averages a per-day percentage, so a single near-zero day dominates it and can report an error in the thousands of percent. Both are returned because MAPE is what people ask for; WAPE is what should be quoted.

Days with **zero** actual demand are excluded from MAPE (the division is undefined, not large) and counted in `mapeExcludedPoints`. They still count toward WAPE, MAE and RMSE.

`accuracyPercent` is `100 − WAPE`, floored at 0. `biasPercent` is signed: **positive means the forecast ran high**, and the direction matters more than the size — under-forecasting is what causes stockouts.

### What can be scored

Only forecast days that have already happened **and** have a matching `DemandHistory` row. A missing actual is skipped, not treated as zero — "that day is not loaded yet" is not "nobody ordered".

The executor only forecasts forward, so **a freshly created run has nothing to score**. That is why `runId` defaults to the newest run whose horizon has partly elapsed rather than the newest run, and why `groups` is empty with a `note` when nothing can be measured.

### `dataCaveat` is always present

The seeded demand comes from a generator in `prisma/seed.ts`. An oracle that knows that generator floors at about **10.65% WAPE**, and the model already matches it — so these numbers measure how well XGBoost recovers a known formula, not forecast skill. The field is returned on every response so the figure cannot be quoted without it.

---

## `GET /network` and `GET /skus`

`forecastDays` is the number of **distinct calendar days** in the horizon.

This is worth stating because it was wrong: it counted forecast *rows*, which is days × products × warehouses. Dividing a total by that produced a per-day figure 40× too small and a growth rate of −98% against trailing demand. `growthPercent` compares like for like — the horizon's daily average projected over 30 days, against the trailing 30 days — because a horizon total against a 30-day total mostly measures the difference in window length.

---

## `GET /insight`

Observations derived from the data, each carrying the number behind it:

```json
{ "data": { "observations": [
  { "kind": "trend", "detail": "Forecast demand over 30 days moves up 4.2% against the first week" },
  { "kind": "network", "detail": "Northeast DC shows the largest change against its trailing 30 days at -11.53%" },
  { "kind": "accuracy", "detail": "No forecast day has been realised yet, so accuracy is not measurable" }
] } }
```

Not prose. The route this replaced returned a written paragraph about flu trends that was true of no particular dataset.

---

## Errors

| Status | When |
| --- | --- |
| `404` | Unknown `sku`, `warehouse`, or `runId` |
| `422` | `days` or `historyDays` outside its bounds |

An empty result is **not** an error — it is `200` with nulls and `planningRunId: null`.

---

## Percentages the server computes

- `/seasonality` entries carry `indexPercent` beside `index` (the index times 100, which is what a chart plots), and `monthlyPattern` labels are month names rather than numbers.
- `/impact` carries `serviceLevelPercent` beside `serviceLevel`.

Both exist so a caller renders what the API states instead of scaling it.
