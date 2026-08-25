# Planning API

Mounted at `/api/planning` (`src/routes/planning_route.ts`). Three routes: one that starts a run, two that read one back.

Shared conventions — response envelope, error codes, headers and rate limits — are in [`conventions.api.md`](conventions.api.md) and not repeated here. What the run actually computes is in [`planning.executor.md`](planning.executor.md).

A **planning run** is one pass of the planner over the whole network: forecast every product/warehouse pair, project inventory forward, propose transfers and replenishment orders, cost the result, simulate it, and write recommendations. It is asynchronous — the POST answers `202` in milliseconds and the work happens behind it — so every planning client is a poll loop.

**A run proposes; it never moves stock.** `Inventory`, `InventoryBatch`, `DemandHistory` and `DistributorOrder` are read-only to the planner.

---

## `POST /api/planning/runs`

Creates a run and schedules it. Rate limited on the **`expensive`** tier (10 per hour) — each call queues roughly ten thousand rows of work.

### Request

```json
{ "horizonDays": 30, "scenarioId": "cmt6...", "modelVersion": "baseline-v2" }
```

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `horizonDays` | integer 1–365 | `30` | How many days forward to plan |
| `scenarioId` | string | — | An existing [`Scenario`](scenarios.api.md). Its multipliers are applied *after* the forecast returns. Unknown id is `404` |
| `modelVersion` | string ≤ 64 | — | A label for this run. The executor overwrites it with the model that actually produced the forecast |

Unknown fields are **rejected** (`422`), unlike the `GET` routes where unknown query parameters are ignored. A body that silently drops a misspelled `horizonDay` would plan the wrong horizon.

| Request header | Effect |
| --- | --- |
| `Idempotency-Key` | 8–255 chars of `[A-Za-z0-9._:-]`. A repeat of the same key returns the original run with `200` and does **not** execute anything a second time |

### Response `202`

```json
{
  "data": {
    "id": "cmt7a1b2c0000abcd1234efgh",
    "status": "PENDING",
    "horizonDays": 30,
    "modelVersion": null,
    "scenario": null,
    "createdById": "cmt6kui7x000074jd8xk1p0aa",
    "createdAt": "2026-08-25T02:05:12.024Z",
    "startedAt": null,
    "completedAt": null,
    "durationSeconds": null,
    "stale": false
  },
  "meta": { "generatedAt": "2026-08-25T02:05:12.028Z", "planningRunId": "cmt7a1b2c0000abcd1234efgh" }
}
```

`Location` points at `/api/planning/runs/{id}`. The status is `PENDING`, not `RUNNING`: the response is written before the executor is handed the run.

| Status | Meaning |
| --- | --- |
| `202` | Created and scheduled |
| `200` | Idempotency replay — the same run as the first call, not a new one |
| `409` | `CONFLICT`. Either a run is already active (`details.activeRunId`, `details.status`), or a request with this `Idempotency-Key` is still in flight |
| `404` | `scenarioId` does not exist |
| `422` | Body failed validation |
| `503` | `SERVICE_UNAVAILABLE` — no `User` row exists to own the run. Seed the database |

**One active run at a time.** A second POST while a run is `PENDING` or `RUNNING` is a `409`, not a queue. Two concurrent runs would fight over the same artifact tables and neither would be reproducible.

---

## `GET /api/planning/runs`

Paginated history, newest first.

| Parameter | Type | Default |
| --- | --- | --- |
| `status` | `PENDING` \| `RUNNING` \| `COMPLETED` \| `FAILED` \| `CANCELLED` | — |
| `scenarioId` | string | — |
| `page` | integer ≥ 1 | `1` |
| `pageSize` | integer 1–100 | `20` |

Returns the same run shape as the POST, in `data.items`, with `page`, `pageSize` and `total` in `meta`.

---

## `GET /api/planning/runs/:id`

One run, plus what it produced. This is the poll target.

### Response `200`

```json
{
  "data": {
    "id": "cmt7a1b2c0000abcd1234efgh",
    "status": "COMPLETED",
    "horizonDays": 30,
    "modelVersion": "naive-seasonal-fallback",
    "scenario": { "id": "cmt6...", "name": "Flu surge +60%" },
    "createdById": "cmt6kui7x000074jd8xk1p0aa",
    "createdAt": "2026-08-25T02:05:12.024Z",
    "startedAt": "2026-08-25T02:05:12.101Z",
    "completedAt": "2026-08-25T02:05:34.550Z",
    "durationSeconds": 22,
    "stale": false,
    "artifacts": {
      "forecasts": 4800,
      "inventoryPlans": 4800,
      "supplyPlans": 512,
      "drpPlans": 147,
      "recommendations": 183,
      "optimization": true,
      "simulation": true
    }
  },
  "meta": { "generatedAt": "2026-08-25T02:05:40.010Z", "planningRunId": "cmt7a1b2c0000abcd1234efgh" }
}
```

| Field | Meaning |
| --- | --- |
| `status` | `PENDING` → `RUNNING` → `COMPLETED` or `FAILED` |
| `modelVersion` | Which model produced the forecast. `naive-seasonal-fallback` means the forecasting service was unreachable or unconfigured |
| `durationSeconds` | `null` until both `startedAt` and `completedAt` exist |
| `stale` | `true` when a run is still active but older than `PLANNING_RUN_TIMEOUT_MS` — nobody is executing it any more |
| `failureReason` | One sentence, `null` unless the run FAILED. At most 500 chars, connection strings redacted, never a stack trace |
| `failureStage` | Which stage threw: `inputs`, `forecast`, `projection`, `allocation`, `supply`, `optimization`, `simulation`, `recommendations`, `complete`. Also `abandoned` (swept after the run timeout) and `shutdown` (the server stopped mid-run) |
| `artifacts` | Live row counts, so a client can watch the run fill in. Counts belonging to a run that never completes are **not** a plan; see below |

`404` when the id is unknown.

### Reading a run that failed

A `FAILED` run carries `failureReason` and `failureStage` in the response:

```json
{
  "status": "FAILED",
  "failureReason": "forecast service answered 502",
  "failureStage": "forecast",
  "completedAt": "2026-08-26T02:05:19.402Z"
}
```

They are on every run shape, `null` on runs that have not failed. Artifacts written before the failure are deliberately kept — they say how far the run got — but **a run is only real once `COMPLETED`**. Never read plans from a run in any other status.

---

## `GET /api/planning/runs/:id/compare?baseline=<runId>`

The delta between two completed runs — `:id` is the scenario, `baseline` is the do-nothing.

This is what turns "+60% flu spike vs do-nothing" from two tables into an answer. Every figure is read from artefacts the executor already wrote; nothing is recomputed, so a comparison can never disagree with the runs it describes.

| Parameter | Required | Notes |
| --- | --- | --- |
| `baseline` | **yes** | The run to compare against. Not defaulted to "the previous run" — a baseline that moved on its own would change the meaning of two identical requests |

### Response `200`

```json
{
  "data": {
    "scenario": { "id": "cmt9...", "horizonDays": 7, "modelVersion": "medcare-xgb-qrf-v1",
                  "scenario": { "id": "cmt9...", "name": "Flu surge +60%",
                                "demandMultiplier": 1.6, "serviceLevelTarget": 0.98 },
                  "completedAt": "2026-08-26T04:20:11.004Z" },
    "baseline": { "id": "cmt9...", "scenario": null, "...": "same shape" },
    "headline": {
      "stockoutDaysAvoided": -32.65,
      "writeOffUnitsAvoided": 10318.64,
      "costSaved": 29091.05,
      "serviceLevelChange": -0.04,
      "transfersProposed": -3
    },
    "cost": { "holding": {"baseline":5014.79,"scenario":4652.39,"delta":-362.4,"percentChange":-7.23},
              "stockout": {}, "transfer": {}, "expiry": {}, "total": {} },
    "risk": { "serviceLevel": {}, "stockoutProbability": {}, "expiryProbability": {},
              "expectedInventory": {}, "expectedWaste": {}, "expectedCost": {} },
    "plan": { "forecastDemand": {}, "safetyStock": {}, "expectedStockoutDays": {},
              "transfers": {}, "transferUnits": {}, "recommendations": {} },
    "warnings": []
  }
}
```

### Reading the signs

Every entry in `cost`, `risk` and `plan` is `{ baseline, scenario, delta, percentChange }` where **`delta` is `scenario - baseline`**. The sign means different things per metric — a negative cost delta is a saving, a negative service-level delta is a regression — so `headline` is **pre-oriented: positive always means the scenario did better**. `percentChange` is `null` when the baseline is `0`, where a percentage has no meaning.

`expectedStockoutDays` is the **sum of per-day stockout probabilities**, which is the expected number of stockout cell-days. Counting only the days over some threshold would discard every near-miss the scenario caused.

`serviceLevel` is a **type-2 fill rate**: the share of simulated demand met from stock.

### `warnings`

Non-blocking notes that the two runs may not be like for like. Empty when they are.

| Warning | Why it matters |
| --- | --- |
| Horizons differ | A 30-day run holds stock longer than a 7-day one whatever the scenario did, so absolute totals are not comparable. Said out loud rather than silently normalised, because which figure you want depends on the question |
| Different forecast models | Part of the difference is the model, not the scenario |
| Neither run has a scenario | You are comparing two baselines |

### Errors

| Status | When |
| --- | --- |
| `404` | Either run id is unknown |
| `409` | Either run is not `COMPLETED`; the two ids are the same; or a completed run is missing its cost roll-up or simulation |
| `422` | `baseline` was not supplied |

A run is only real once `COMPLETED`, so comparing anything else would be reading artefacts that are unreachable by contract. Comparing a run against itself is refused rather than answered with a wall of zeros.

---

## `GET /api/planning/runs/:id/optimization`

The run's cost roll-up on its own — a legitimate question ("what did this plan cost") that should not require inventing a second run to diff against.

```json
{ "data": {
  "planningRunId": "cmt9...",
  "objectiveValue": 43972.79, "totalCost": 43972.79,
  "holdingCost": 4652.39, "stockoutCost": 4742.78,
  "transferCost": 3039.9, "expiryCost": 31537.72,
  "componentSum": 43972.79,
  "baselineCost": null,
  "solver": "greedy-drp", "solverStatus": "FEASIBLE"
} }
```

`componentSum` is the four components added up, returned so a caller can check they equal `totalCost` without doing the arithmetic itself.

`solver` is `greedy-drp` because that is what it is — a heuristic roll-up, not an LP. `objectiveValue` equals `totalCost`, since the objective is to minimise it and a second number would only invite the two to disagree.

## `GET /api/planning/runs/:id/simulation`

The Monte Carlo result: `iterations`, `serviceLevel`, `stockoutProbability`, `expiryProbability`, `expectedInventory`, `expectedWaste`, `expectedCost`.

`serviceLevel` is a **type-2 fill rate** — the share of simulated demand met from stock. `stockoutProbability` counts cell-days with a shortfall. They are different measures and do **not** sum to 1.

### Both `404` when the run produced nothing

A run that never completed has no plan, so it has no cost and no simulation. That is a `404` rather than an empty body, because the resource genuinely does not exist. An unknown run id is also `404`.

---

## Who acts on a request

`createdById` on a run, and `actedById` on a recommendation, come from **`req.userId`**, set by `src/middleware/currentUser.ts`.

There is no authentication yet, so it holds a stand-in: the seeded SYSTEM user. **When auth is added, its middleware sets `req.user` ahead of `currentUser` and `req.userId` becomes the authenticated id** — every route that records an actor keeps working untouched. `src/lib/actor.ts` is the single place that resolves it.

Outside production an `x-user-id` header overrides the stand-in, which makes the recommendation and alert lifecycles testable with more than one actor. It is consulted **only when nothing has authenticated**, so it can never shadow a real user, and it is ignored entirely in production.

An id that is not a real `User` row falls back to the stand-in rather than failing the write: `actedById` is a foreign key, and an unknown id would otherwise fail the insert with an error that says nothing about why.

---

## Lifecycle and scheduling

```
POST -> 202 PENDING -> (setImmediate) RUNNING -> COMPLETED
                                              -> FAILED (failureReason, failureStage)
```

- Runs execute **in-process**, scheduled with `setImmediate` after the response is flushed (`src/lib/planning-runner.ts`). Ten thousand rows in well under a minute does not need a queue, and the single-active-run rule already caps concurrency at one.
- `PLANNING_EXECUTOR=disabled` stops scheduling entirely: runs are created and stay `PENDING`. The test suite uses this so it can drive `executeRun()` directly.
- An idempotency **replay never schedules**. It returns the run the first call created, whatever state that run is now in.
- **On shutdown**, the server stops listening, then waits for scheduled runs to finish. Anything still running when the budget expires is marked `FAILED` with a reason, so a restart never leaves a run stuck at `RUNNING`.
- **At boot**, runs left active by a previous process and older than `PLANNING_RUN_TIMEOUT_MS` are swept to `FAILED` — a crashed run does not block the next POST until someone notices.

### Polling

Poll `GET /api/planning/runs/:id` every second or two. A 30-day run over 160 positions finishes in tens of seconds. Stop on `COMPLETED` or `FAILED`; treat `stale: true` on an active run as failed.
