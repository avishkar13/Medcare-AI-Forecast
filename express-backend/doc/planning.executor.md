# Planning executor

What turns a `PENDING` planning run into a `COMPLETED` one with artefacts, or a `FAILED` one with a reason.

This is not a route. It is `executeRun(runId)` in `src/services/planning-executor.service.ts`, called after `POST /api/planning/runs` answers `202` — see [Scheduling](#scheduling) for what does the calling. Nothing here touches HTTP.

Shared conventions — response envelope, error codes, headers and rate limits — are in [`conventions.api.md`](conventions.api.md).

---

## Stages

Run in order. The stage name is recorded on `PlanningRun.failureStage` when one throws, so a failed run says how far it got.

| # | Stage | Reads | Writes | Rows at 40 SKUs × 4 DCs × 30 days |
| --- | --- | --- | --- | --- |
| 0 | claim | `PlanningRun` | `status`, `startedAt` | 1 |
| 1 | `inputs` | positions, batches, planning parameters, scenario | — | reads ~450 |
| 2 | `forecast` | the forecasting service, or the naive fallback | — | 4,800 points |
| 3 | `forecast` | — | `Forecast` | **4,800** |
| 4-6 | `projection` / `allocation` / `supply` | the forecast | `InventoryPlan`, `DRPPlan`, `SupplyPlan` | **4,800** / ~100 / ~500 |
| 7 | `optimization` | the artefacts in memory | `OptimizationResult` | 1 |
| 8 | `simulation` | the forecast bands | `SimulationRun` | 1 |
| 9 | `recommendations` | the artefacts in memory | `Recommendation` | ≤ 200 |
| 10 | `complete` | — | `status`, `completedAt`, `modelVersion` | 1 |

Roughly 10,000 rows per run, in well under a minute.

## One forward pass, not three

Projection, transfers and order releases are **interdependent**: an arrival changes the projection, and whether a transfer is worth making on a given day depends on every warehouse's position on *that same day*. Running them as three sequential passes would plan against stale inventory.

So there is a single day-loop from `day 1` to `horizonDays`, and inside each day:

1. **Project** every position — opening inventory plus arrivals, minus forecast demand, floored at zero. Emits one `InventoryPlan` row per position per day.
2. **Allocate** across warehouses of the same product, via `planTransfers()` in `utils/allocation.ts` — the same expiry-aware matcher `/api/dashboard/priority-actions` uses, so the two can never disagree. Emits `DRPPlan` plus a `TRANSFER` `SupplyPlan` at the arrival date.
3. **Release orders** on the review cadence only (`day % reviewPeriodDays === 0`), sized by an order-up-to level. Emits a `PLANNED_SUPPLY` `SupplyPlan`.

Quantity comes from the order-up-to level, frequency from `reviewPeriodDays`. That pair is the "optimise replenishment quantity and frequency" the brief asks for.

## How sensing reaches the plan

The mechanical link, and the reason the demo works:

```
forecast band  ->  stdDevFromBand(p10, p90)  ->  safetyStock  ->  reorderPoint  ->  earlier replenishment
```

Safety stock is computed from **forward** demand — the mean `p50` over the lead-time window and the spread implied by the band — not from the trailing 90-day mean that `/api/dashboard/*` uses. A sensed surge widens the band, which raises safety stock, which fires replenishment sooner. No other stage needs to know a surge happened.

Scenario multipliers apply **after** the forecast returns, in `buildCells()`. Python stays a pure forecaster, and one forecast can be re-scored under several scenarios without refitting.

## Transactions

**Bulk artefacts are written outside any transaction**, chunked 1,000 rows at a time. Ten thousand inserts in one interactive transaction would hold locks for the whole run and exceed Prisma's transaction timeout.

That is safe because of a contract, not luck: **a run is only real once its status is `COMPLETED`**. Artefacts belonging to a run that never completes are unreachable — no route returns them — so a partial write is invisible rather than wrong.

**One short transaction closes the run**, in `completeRun()`: `OptimizationResult`, `SimulationRun`, the `Recommendation` rows and the status flip, together. Either a run is complete with its headline numbers, or it is not complete at all.

## Failure

| Behaviour | Why |
| --- | --- |
| `status: FAILED`, plus `failureReason` and `failureStage` | Before these columns existed every failed run looked identical from the API |
| Artefacts written before the failure are **kept** | A run that produced 4,800 forecasts and no plans tells you exactly where it broke. They are unreachable anyway, per the rule above |
| `failureReason` is one sentence, ≤ 500 chars, connection strings redacted, never a stack trace | It is served over HTTP |
| A dead forecasting service falls back to the naive forecast | With `FORECAST_FALLBACK=true`, the default. The run still completes, and `Forecast.modelVersion` records `naive-seasonal-fallback` |
| With the fallback disabled, the run fails at `failureStage: "forecast"` | In seconds — `FORECAST_TIMEOUT_MS` × attempts — not after the 15-minute run timeout |

## Concurrency

The claim is a **compare-and-swap**, not the Redis lock:

```ts
updateMany({ where: { id, status: "PENDING" }, data: { status: "RUNNING", startedAt } })
```

Zero rows affected means someone else claimed it, and the call returns `SKIPPED`. This survives Redis being down, and it cannot expire underneath a run that is still working — the run lock in `planning.service.ts` has a 10-second TTL and guards *creation*, which is a different problem.

Re-execution is idempotent: every stage clears its own table for that run first (`clearRunArtifacts`), so running the same run twice converges instead of doubling.

## Scheduling

`src/lib/planning-runner.ts` is the only caller in production, and the only file that would change if runs ever moved to a worker container.

| Moment | What happens |
| --- | --- |
| After the `202` is written | `scheduleRun(id)` hands the run to `setImmediate`. It never throws and never awaits — the client already has its response |
| A duplicate `scheduleRun` for the same id | Ignored. The runner keeps one promise per run id, and the claim would refuse the second one anyway |
| An idempotency replay | **Not scheduled.** A replay returns the run the first call created; re-executing it would double the work for a client that retried a network timeout |
| Shutdown | `drainPlanning()` runs between `server.close()` and the Prisma/Redis disconnects — a run in flight still needs its connections. It gets 80% of `SHUTDOWN_TIMEOUT_MS`; the rest is reserved for marking whatever did not finish `FAILED` and disconnecting |
| Boot | `failAbandonedRuns()` sweeps runs left `PENDING`/`RUNNING` by a previous process and older than `PLANNING_RUN_TIMEOUT_MS`. Without it, a crash blocks the next POST with a `409` until someone notices |

**In-process, deliberately.** Roughly 10,000 rows finishing in well under a minute does not justify a queue, and `insertRun` already caps concurrency at one active run. A worker would add a broker, a second deployable and a serialisation format to solve a problem this workload does not have.

## What it never does

- **Never mutates operational state.** `Inventory`, `InventoryBatch`, `DemandHistory` and `DistributorOrder` are read-only here. A `DRPPlan` is a proposal; nothing moves stock. There is an integration test asserting the totals are unchanged after a run.
- **No approvals.** `SupplyPlan.status` stays `PROPOSED`.
- **No recommendation lifecycle.** `acknowledgedAt`, `resolvedAt` and `actedById` belong to the review route.
- **No forecast backtesting.** Accuracy compares a *past* run's forecasts to realised demand, which is a read-side concern.
- **No LP or MIP.** `solver` is recorded as `greedy-drp` because that is what it is — a heuristic roll-up, not an optimiser. `objectiveValue` equals `totalCost`, since the objective is to minimise it and a second number would only invite the two to disagree.

## Configuration

| Variable | Default | Effect |
| --- | --- | --- |
| `PLANNING_EXECUTOR` | `inline` | `disabled` stops scheduling: runs are created and stay `PENDING`. The test suite defaults to `disabled` so its "a new run is `PENDING`" assertions cannot race the executor, and drives `executeRun()` directly instead |
| `PLANNING_SIMULATION_ITERATIONS` | `500` | Monte Carlo iterations. The only CPU-bound stage; it yields every 50 iterations so readiness keeps answering |
| `FORECAST_SERVICE_URL` | unset | Unset means the naive fallback is the only path |
| `FORECAST_FALLBACK` | `true` | `false` makes a forecasting outage fail the run instead |

The simulation seed is fixed in `src/config/constants.ts`, so two runs over the same inputs produce the same cost. A run that cannot be reproduced cannot be compared against another one, and comparison is the point.
