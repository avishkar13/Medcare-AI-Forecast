# Models API

Mounted at `/api/planning/models` (`src/routes/models_route.ts`).

Shared conventions are in [`conventions.api.md`](conventions.api.md).

Fitting the forecasting model, and reading how the last fit scored. Express is the only caller of the engine: **the frontend calls Express, Express calls Python, never the other way round.** The one documented reverse direction is the engine pulling [`GET /api/training-data`](training.api.md).

---

## `POST /train`

On the **`expensive`** tier (10/hour). A fit is minutes of CPU on the engine and rewrites its model artefact.

```json
{ "modelVersion": "medcare-xgb-qrf-v1" }
```

Optional. Omitted, the engine uses its configured default. The label is written to `Forecast.modelVersion` by later runs, so it is how a forecast row says which fit produced it.

### Response `200`

```json
{ "data": {
  "modelVersion": "medcare-xgb-qrf-v1",
  "trainingRecords": 19360, "testRecords": 4960,
  "calibrationOk": true,
  "metrics": { "mae": 4.88, "rmse": 6.90, "wape": 9.65 },
  "bias": -1.26, "coverage": 79.84,
  "ms": 39457
} }
```

The engine pulls `GET /api/training-data` itself — the same endpoint inference uses — fits, evaluates on a chronological holdout, and returns the summary. One data path for fit and predict, so features cannot skew between them.

`calibrationOk` is the engine's own check that its `p10`–`p90` band covers about 80% of the holdout. `coverage` is the measured figure. A band that is wrong makes safety stock wrong, so a fit that reports `false` should not be shipped.

### Not retried

Every other engine call is idempotent and cheap. A fit costs minutes and rewrites the model files, so a retry could stack two trainings over the same artefacts. A `5xx` fails immediately here even though `requestForecast` would retry it; a caller wanting another attempt asks again.

`FORECAST_TRAIN_TIMEOUT_MS` (default `600000`) is separate from `FORECAST_TIMEOUT_MS` for the same reason — a forecast is seconds, a fit is minutes, and one budget cannot serve both.

## `GET /metrics`

The last fit's full report, straight from the engine: baseline comparison, point metrics, quantile metrics, and the rolling time-series CV folds. `404` when nothing has been trained.

---

## How this pairs with accuracy

| Route | Measures |
| --- | --- |
| `POST /train` | The model **at fit time**, on a held-out slice of history |
| [`GET /api/forecast/accuracy`](forecast.api.md) | A **past run's** forecasts against demand that actually happened |

Both are needed before anyone claims accuracy improved. A good holdout score with poor realised accuracy means the model is fitting something that does not persist.

**Both are measured on generated data.** See the `dataCaveat` on the accuracy route.

| Status | When |
| --- | --- |
| `200` | Trained, or metrics returned |
| `404` | No model has been trained yet (`/metrics`) |
| `422` | `modelVersion` failed validation, or an unknown field was sent |
| `502` | The engine answered an error — its own message is surfaced |
| `503` | No engine is configured (`FORECAST_SERVICE_URL` unset) |
