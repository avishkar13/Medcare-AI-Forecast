# Simulation API

Mounted at `/api/simulation` (`src/routes/simulation_route.ts`).

Shared conventions are in [`conventions.api.md`](conventions.api.md).

The what-if surface. It is a thin, UI-shaped front for [scenarios](scenarios.api.md) and [planning runs](planning.api.md): a simulation **is** a real planning run under a scenario.

---

## A simulation is a run, not a formula

`POST /run` creates a `Scenario`, starts a `PlanningRun` against it, and answers `202` with the run to poll. The results come from `GET /api/planning/runs/:id` and `.../compare` once it completes.

This matters because the route it replaces computed `15.2 + demandShock * 0.3` and returned it as a stockout risk, beside a hardcoded SKU and DC. The numbers moved when you changed the input, which made them look derived from something.

`createRun` is reused rather than inserting a run directly, so the single-active-run guard, the idempotency path and executor scheduling all apply exactly as they do to a normal run. **A second what-if while one is still active is a `409`** — two concurrent runs would fight over the same artefact tables.

## Percentages in, multipliers stored

The UI works in percentage changes; a `Scenario` stores multipliers. The conversion lives in `src/services/simulation.service.ts` and round-trips, so a saved scenario returns to the form that made it.

| Parameter | Range | → | Scenario field |
| --- | --- | --- | --- |
| `demandShockPercent` | −90 … 400 | `1 + p/100` | `demandMultiplier` |
| `leadTimeChangePercent` | −90 … 400 | `1 + p/100` | `leadTimeMultiplier` |
| `capacityChangePercent` | −90 … 400 | `1 + p/100` | `capacityMultiplier` |
| `serviceLevelTargetPercent` | 50 … 99.9 | `p/100` | `serviceLevelTarget` |

The bounds mirror [`scenarios.api.md`](scenarios.api.md)'s 0.1×–5× expressed as percentages, so the two ways of creating a scenario cannot accept different things.

---

## `POST /run`

On the **`expensive`** tier (10/hour): it schedules a full planning run behind the response.

```json
{ "name": "Flu surge +60%", "horizonDays": 30,
  "params": { "demandShockPercent": 60, "serviceLevelTargetPercent": 98 } }
```

Unknown fields are rejected — a misspelled `demandShockPct` would otherwise run a neutral scenario under a surge scenario's name.

### Response `202`

```json
{ "data": {
  "scenario": { "id": "cmt9...", "name": "Flu surge +60%",
                "params": { "demandShockPercent": 60, "...": "" },
                "multipliers": { "demandMultiplier": 1.6, "...": "" },
                "planningRunCount": 0 },
  "run": { "id": "cmt9...", "status": "PENDING", "...": "" },
  "pollAt": "/api/planning/runs/cmt9...",
  "compareAt": "/api/planning/runs/cmt9.../compare?baseline=<runId>"
} }
```

`pollAt` and `compareAt` are spelled out because the route this replaced returned finished-looking numbers immediately and there was nothing to wait for.

| Status | When |
| --- | --- |
| `202` | Scenario created, run scheduled |
| `409` | A planning run is already active |
| `422` | A parameter is out of band, or an unknown field was sent |
| `503` | No `User` exists to own the scenario — seed the database |

---

## Saved scenarios and history

The two lists are **disjoint**, split on whether the scenario has ever been run:

| Route | Contains |
| --- | --- |
| `GET /saved` | Scenarios with **no** planning runs — presets set up for later |
| `GET /history` | Scenarios that **have** run, each with its `latestRun` |

Both take `limit` (1–100, default `20`). The route this replaced returned a single hardcoded fake preset from `/saved`.

## `POST /save`

Stores parameters without running anything. `201` with the scenario.

## `DELETE /saved/:id`

`204` on success.

**A scenario that a run points at cannot be deleted** — the run would lose the record of what it was modelling. That is a `409` naming the run count, rather than the raw foreign-key error the database would otherwise raise.

| Status | When |
| --- | --- |
| `204` | Deleted |
| `404` | No such scenario |
| `409` | The scenario has planning runs |
