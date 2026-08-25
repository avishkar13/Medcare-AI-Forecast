# Integration notes

The wire contract lives in `express-backend/doc/forecast.contract.md` and is the
authority. This file records what changed on the engine side to meet it, and the
decisions that were not obvious.

## What changed, and why

| Before | Now | Why |
| --- | --- | --- |
| Read PostgreSQL directly with `psycopg` (`DemandHistory`, `PromotionEvent`, `Product`, `Warehouse`) | Reads `GET {API_BASE_URL}/training-data` | The contract makes Prisma the only owner of the schema. Two writers of the same tables is how a migration silently breaks a model |
| `POST /forecast {sku_id, warehouse_id, horizon_days}` — one series per call | `POST /forecast {runId, horizonDays, asOf, pairs[]}` — every series in one call | A planning run needs 160 series. One call per pair would be 160 round trips against a 10/hour rate limit |
| Keyed on `Product.sku` / `Warehouse.code`, with a database lookup for the cuids | Keyed on `productId` / `warehouseId` cuids | Both key forms travel on every export row, so the lookup is local and no join is needed |
| `{forecast, lower_bound, upper_bound, daily_forecasts[...]}` | `{modelVersion, generatedAt, horizonDays, forecasts:[{productId, warehouseId, start, p10[], p50[], p90[]}]}` | Dense parallel arrays make "no missing days" structural rather than something the reader has to check |
| Horizon capped at 30 | `ENGINE_MAX_HORIZON_DAYS`, default 180 | The planner's default run is 30 days but the API accepts up to 365 |
| Errors as `400 {"detail": "..."}` | `{"error": {"code", "message"}}` with 422 / 500 / 502 | Express retries 5xx and 429 and never retries 4xx. A 400 for "the model is not trained" would have been retried zero times and reported as a client error |
| `p10` could exceed `p50` | Every band clamped to `p10 <= p50 <= p90`, `>= 0` | Independently fitted quantile models cross. Express rejects the **whole response** over one crossed band |
| Forecast started at the last history date | Starts at `asOf + 1`, exactly `horizonDays` values | The contract pins `start`; Express checks it |
| A pair with thin history raised | Falls back per series; unknown pairs return zeros | The response must carry exactly one entry per requested pair. Failing one series would fail the caller's entire planning run |
| One feature rebuild per series per day | One rebuild per day across all series | ~9x faster: 160 pairs × 30 days went from 36s to 4s |
| `transform(lambda s: s.rolling(...))` | `groupby().rolling()` | Same numbers to the bit, ~16x faster. The lambda walked 160 groups in Python per feature per day |

## What the engine cannot see

`/api/training-data` carries demand history and its flags. It does **not** carry
`DemandSignal` (flu incidence) or forward-dated `PromotionEvent` rows.

So future promotion flags are `0` rather than invented, and seasonality for a future day
is what that series actually did on that weekday and in that month. A sensed flu surge
reaches the plan through history, not as a leading indicator.

Closing that gap means publishing those two tables from Express — a `signals` field on the
export, or a second endpoint. It is a backend change, not an engine change, and it is the
single biggest available improvement to forecast quality.

## Boundary

The engine does not write `Forecast`, `InventoryPlan`, `SupplyPlan`, `DRPPlan`,
`OptimizationResult`, `SimulationRun` or `Recommendation`. It returns numbers; Express
persists them against a `planningRunId` it owns.

## What the numbers mean

**The demand data is generated**, by `express-backend/prisma/seed.ts:187`:

```
ordered = round(baseline x share
        x seasonalMultiplier(month)      // deterministic
        x weekdayMultiplier(dayOfWeek)   // deterministic, 7 values
        x (promo ? U(1.3,1.8) : 1)       // 4% of days, unpredictable
        x U(0.82, 1.18))                 // +/-18% uniform noise
```

So every accuracy figure below measures how well XGBoost recovers a known formula, not
how it would forecast real pharmaceutical demand. **Do not quote them as forecast
accuracy.** Simulating an oracle that knows the generator but not the future coin flips
gives the floor no forecaster can beat:

| | wMAPE | bias |
| --- | --- | --- |
| Oracle predicting the mean | 10.65% | +0.01% |
| Oracle predicting the median | 10.60% | -2.14% |
| **Engine, one-step** | **9.67%** | -1.26% |
| **Engine, recursive 14-day** | **11.40%** | -3.62% |
| 7-day moving average baseline | 25.43% | +0.79% |

One-step sits *below* the floor, which means the model partly memorises the seeded PRNG.
Recursive is 0.75 points off optimal. **There is no accuracy headroom on this data**, and
tuning against it is fitting a fixture. Real data will move all of this.

The oracle row also explains a real bug rather than a fixture artifact: predicting the
median carries -2.14% bias *by construction*, which is why p50 is the point model.

## Calibration

`p10-p90` is a nominal 80% interval and the planner turns it into safety stock, so it
has to mean what it says.

| | before | after |
| --- | --- | --- |
| `conformal_delta` | +8.33 | +0.01 |
| p10-p90 coverage (holdout) | 98.8% | **80.2%** |
| p10-p90 coverage (recursive backtest) | ~96% | **78.1%** |
| mean band width | 30.51 | 14.18 |

The old delta was scored on the **point** model's absolute residuals and then added to
**quantile** predictions that already spanned 80% - two independent 80% spreads stacked.
Proper split CQR scores the quantile models themselves, so the delta collapsed to
approximately zero: the raw quantiles were right all along.

`python -m src.backtest` re-runs this check on the production recursive path.

### Known limitation: sigma for safety stock

Node derives a standard deviation from the band (`utils/inventory.ts`,
`stdDevFromBand = (p90-p10)/2.5631`) and feeds it to a normal-theory safety stock
formula. That round trip only holds if forecast errors are normal. **They are not**:
kurtosis 25.9, skew +3.28, and 63% of the error variance comes from the worst 4% of days
- the unpredictable promotion spikes.

Measured, one day of buffer at a 95% service level:

| source of sigma | buffer | service achieved |
| --- | --- | --- |
| band-derived (ships today) | 9.81 | **88.4%** |
| moment standard deviation | 15.97 | 95.5% |
| empirically required | 15.09 | 95% |

A correctly calibrated 80% interval and a usable sigma are **different widths** here, and
one number cannot be both. Resolving it means giving the planner its own channel - an
explicit `sigma` on the forecast contract - rather than reconstructing one from a display
band. Until then the band is honest and the buffer is thin.

## Verified end to end

Against the deployed backend on 2026-08-26. Read the caveat above before quoting any of it:

| Check | Result |
| --- | --- |
| `python -m src.train_project` | 28,800 rows pulled, coverage 80.2%, `calibration_ok: true` |
| 160 pairs × 30 days | 160 series, correct `start`, no crossed bands, no negatives, no missing or extra pairs |
| Timing | ~12s cold, ~4s warm, against a 60s `FORECAST_TIMEOUT_MS` |
| `POST /api/planning/runs` with the engine up | `COMPLETED`, `modelVersion: medcare-xgb-qrf-v1`, 2,240 forecasts in 9s |
| `POST /api/planning/runs` with the engine down | `COMPLETED`, `modelVersion: naive-seasonal-fallback` — the outage never reached the planner |
