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
