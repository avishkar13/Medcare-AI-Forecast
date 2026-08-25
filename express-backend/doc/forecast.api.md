# Forecast API

Mounted at `/api/forecast` (`src/routes/forecast_route.ts`). Ten `GET` routes, all on the `read` tier.

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
      { "modelVersion": "medcare-xgb-qrf-v1", "isPrimary": true, "scoredPoints": 640,
        "accuracyPercent": 89.4, "wapePercent": 10.6, "mae": 5.2, "rmse": 7.4 }
    ],
    "note": null
  }
}
```

**One model produced these rows, so one row comes back.** A table comparing several would need several to have run.

**Accuracy is `100 − WAPE`, weighted by volume** — not the mean of per-row percentages. A single near-zero actual would otherwise dominate the average and report a figure nobody would believe.

**A fresh run forecasts only the future, so it has nothing to score.** `models` is then empty and `note` says why, rather than reporting a flattering number drawn from an empty set.

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
