# MedCare forecasting engine

The demand forecasting service behind the Express planner. It fits a model on the
project's demand history and answers one batch question: **what will each product sell
at each DC, per day, for the next N days, with a p10/p50/p90 band.**

Everything else — safety stock, transfers, replenishment quantity, cost, recommendations
— belongs to the Express backend. This service decides nothing about inventory.

## The one rule

**No database.** The engine has no `DATABASE_URL` and no Prisma. It reads history from
`GET {API_BASE_URL}/training-data`, the NDJSON export the Express backend publishes, and
returns forecasts in its response body. It persists nothing but its own fitted model.

That keeps Prisma the only owner of the schema: a migration cannot silently break the
engine, and a model cannot silently write a planning table.

Training and inference use the **same endpoint**, so the features the model is fitted on
are the features it later predicts against.

```
                POST /forecast  { runId, horizonDays, asOf, pairs[] }
Express :4000  ─────────────────────────────────────────────>  engine :8000
      ^                                                              |
      |         GET /api/training-data  (NDJSON)                     |
      +──────────────────────────────────────────────────────────────+
      |
      +──> writes Forecast rows via Prisma
```

The wire contract is `express-backend/doc/forecast.contract.md`. It is the authority;
this README explains how the engine implements it.

## Quick start

```powershell
python -m venv .venv
& ".\.venv\Scripts\python.exe" -m pip install -r requirements.txt
Copy-Item .env.example .env    # then set API_BASE_URL
```

Fit the model — it pulls the export, so the backend must be running:

```powershell
& ".\.venv\Scripts\python.exe" -m src.train_project
```

Serve:

```powershell
& ".\.venv\Scripts\python.exe" -m uvicorn src.api:app --host 0.0.0.0 --port 8000
```

Then point Express at it — `FORECAST_SERVICE_URL=http://127.0.0.1:8000` — and
`/api/health/ready` reports `forecast: up`.

## Endpoints

| Route | Purpose |
| --- | --- |
| `POST /forecast` | The contract. Batch, cuid-keyed, dense arrays out |
| `POST /train` | Refit from the current export. Returns the metrics |
| `python -m src.backtest` | Not a route. Backtests the recursive path and reports wMAPE, bias, coverage and the sigma ratio |
| `GET /health` | `200` only when the export is reachable; `503` otherwise |
| `GET /model/metrics` | The last training run's numbers |

## The model

| Stage | What |
| --- | --- |
| Target | `demand` — `orderedQuantity`, the uncensored signal. **Never `fulfilled`**, which is capped by what was in stock and would teach the model a stockout was a quiet day |
| Features | 28-day lags, rolling mean/median/std, EWM, velocity and acceleration, calendar and Fourier terms, promotion flag and its recent rate, a per-series seasonality index. All built from **shifted** demand, so nothing leaks the target |
| Centre (`p50`) | The **XGBoost point model** - expected demand, not the median. The planner reads p50 as average daily demand, and a median sits below the mean on skewed demand |
| Bands | Quantile XGBoost at 0.10 / 0.90, calibrated by split conformal quantile regression against a held-out chronological slice |
| Validation | Chronological 80/20 holdout, plus rolling `TimeSeriesSplit` CV, against a 7-day moving-average baseline |

Quantile models are fitted independently and **can cross**. The engine clamps every band
to `p10 <= p50 <= p90` and `>= 0` before answering, because Express rejects the entire
response over one crossed band.

The conformal delta is scored on the **quantile** models' own conformity
(`max(q10 - y, y - q90)`), not on point-model residuals. Scoring the point model instead
stacks a second 80% spread on a band that already spans 80%, which is exactly how
coverage reached 99% in an earlier version. A correct delta can be **negative**, which
tightens an over-wide band; the old one could only ever widen.

## What these numbers mean

**The demand data in the database is generated**, not real. Every accuracy figure in this
repository therefore measures how well XGBoost recovers a known seed formula.

An oracle that knows the generator but not its future coin flips bottoms out at **10.65%
wMAPE**. The engine measures 9.67% one-step - *below* the floor, meaning it partly
memorises the seeded PRNG - and 11.40% recursive, 0.75 points off optimal.

**So accuracy is not a lever here.** Tuning features or hyperparameters against this data
is fitting a fixture. What is worth maintaining is calibration and bias, which are
correctness properties that survive the move to real data. `python -m src.backtest`
checks both; `INTEGRATION.md` records the current numbers and one open limitation about
how safety stock is derived.

### Forecasting forward

Lag features mean day *d+1* needs day *d*'s value, so prediction is recursive: p50 is fed
back as the next day's demand. p90 is not — compounding the upper tail would produce a
runaway trend.

All series step forward **together**, one feature rebuild per horizon day rather than one
per series. 160 pairs × 30 days is ~4s warm, ~12s cold.

### Series the model cannot fit

A pair with fewer than `ENGINE_MIN_HISTORY_DAYS` (35) rows cannot fill a 28-day lag. Those
get a weekday profile around their own recent level with a wide band, and a pair the export
has never seen gets zeros. Both are deliberate: the contract requires **exactly one entry
per requested pair**, and a short answer fails the caller's whole planning run instead of
one series.

## Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `API_BASE_URL` | — | Required. e.g. `http://backend:4000/api` |
| `ENGINE_PORT` | `8000` | |
| `ENGINE_MAX_HORIZON_DAYS` | `180` | Only ~180 days of history exist; a longer horizon has no seasonality to learn |
| `ENGINE_MIN_HISTORY_DAYS` | `35` | Below this a series takes the fallback path |
| `TRAINING_CACHE_TTL_SECONDS` | `900` | See below |
| `TRAINING_TIMEOUT_SECONDS` | `120` | |
| `MODEL_VERSION` | `medcare-xgb-qrf-v1` | Written to `Forecast.modelVersion` by Express |

### Why the export is cached

`/api/training-data` is on the backend's **`expensive` tier: 10 requests per rolling hour**.
One pull per forecast request would exhaust it, and Express retries twice on failure. The
engine pulls once and reuses it for `TRAINING_CACHE_TTL_SECONDS`.

Every pull is checked against the `x-training-rows` header. A stream cut short by a timeout
is still valid NDJSON, so comparing the count is the only way to notice the model is about
to be fitted on half a dataset.

## Docker

The engine is a service in `express-backend/docker-compose.yml`:

```powershell
cd ..\express-backend
docker compose up --build
docker compose exec engine python -m src.train_project
```

It depends on `backend` with `service_started`, never `service_healthy` — the dependency
points both ways and gating either side on the other deadlocks the boot. Until the model is
trained the engine answers `MODEL_NOT_TRAINED` and Express plans on its naive fallback,
recording `naive-seasonal-fallback` in `Forecast.modelVersion`.

## Not on the contract path

`src/anomaly.py` (robust-z demand anomaly) and `src/forecasting/forecast.py` (XGBoost
feature importances) work and are tested by use, but nothing calls them: the forecast
contract has no field for either. They are here for a future explainability or signals
route, not dead weight to delete blindly.
