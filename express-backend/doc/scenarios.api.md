# Scenarios API

Mounted at `/api/scenarios` (`src/routes/scenario_route.ts`). Three routes: create one, list them, read one.

Shared conventions — response envelope, error codes, headers and rate limits — are in [`conventions.api.md`](conventions.api.md) and not repeated here.

A **scenario** is a set of multipliers applied to a planning run. It is the "what if" half of the deliverable: a baseline run says what happens if nothing changes, and a run under a flu-surge scenario says what happens if demand jumps 60%. Comparing the two is what [`planning.api.md`](planning.api.md) exists to make possible.

**A scenario stores parameters, nothing else.** It holds no results. Creating one costs a row insert; running one is [`POST /api/planning/runs`](planning.api.md) with a `scenarioId`.

---

## The multipliers

Four numbers, each applied at a different point in [the executor](planning.executor.md). Nothing branches on whether a scenario exists — a run without one uses `NEUTRAL_SCENARIO` (`src/lib/planning-inputs.ts`), which is all 1s and a 0.95 service level.

| Field | Range | Default | Where it lands |
| --- | --- | --- | --- |
| `demandMultiplier` | 0.1–5 | `1` | Scales the whole forecast band — `p10`, `p50` and `p90` together — **after** the forecast returns. The engine stays a pure forecaster, so one forecast can be re-scored under several scenarios without refitting |
| `leadTimeMultiplier` | 0.1–5 | `1` | Multiplies `PlanningParameter.leadTimeDays`, rounded, floored at 1 day. A longer lead time widens the safety-stock window |
| `capacityMultiplier` | 0.1–5 | `1` | Scales `PlanningParameter.maximumInventory`, the ceiling an order-up-to level is clamped to |
| `serviceLevelTarget` | 0.5–0.999 | `0.95` | The z-score in the safety-stock formula. Higher means a bigger buffer |

The bands are not arbitrary. Below `0.1` the arithmetic stops meaning anything — a tenth of a lead time, a tenth of a warehouse. Above `5` a run is modelling a different business rather than a stress case. A service level is a probability, and the z-score blows up as it approaches 1; below 0.5 the buffer goes negative and is clamped to zero anyway.

---

## `POST /api/scenarios`

Rate limited on the `write` tier.

### Request

```json
{
  "name": "Flu surge +60%",
  "description": "Peak flu season across Tier-2 cities",
  "demandMultiplier": 1.6,
  "leadTimeMultiplier": 1,
  "capacityMultiplier": 1,
  "serviceLevelTarget": 0.98
}
```

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `name` | string ≤ 120 | — | Required |
| `description` | string ≤ 500 | — | Optional |
| `demandMultiplier` | 0.1–5 | `1` | |
| `leadTimeMultiplier` | 0.1–5 | `1` | |
| `capacityMultiplier` | 0.1–5 | `1` | |
| `serviceLevelTarget` | 0.5–0.999 | `0.95` | |

Unknown fields are **rejected** (`422`). A misspelled `demandMultipler` that was quietly dropped would produce a neutral scenario wearing a surge scenario's name, and every number downstream would be wrong with nothing to show for it.

Names are not unique. Two scenarios may share one; they are distinguished by id.

### Response `201`

```json
{
  "data": {
    "id": "cmt9b2c3d0000abcd5678ijkl",
    "name": "Flu surge +60%",
    "description": "Peak flu season across Tier-2 cities",
    "demandMultiplier": 1.6,
    "leadTimeMultiplier": 1,
    "capacityMultiplier": 1,
    "serviceLevelTarget": 0.98,
    "createdById": "cmt6kui2o000074jdoy09e1sj",
    "createdAt": "2026-08-26T04:11:02.118Z",
    "planningRunCount": 0
  },
  "meta": { "generatedAt": "2026-08-26T04:11:02.121Z" }
}
```

`Location` points at `/api/scenarios/{id}`.

| Status | Meaning |
| --- | --- |
| `201` | Created |
| `422` | Validation failed — a multiplier out of band, a missing name, or an unknown field |
| `503` | `SERVICE_UNAVAILABLE` — no `User` row exists to own it. Seed the database |

`createdById` is the seeded SYSTEM user: there is no authentication yet, and `src/lib/actor.ts` is the single place that decides. WP-16 replaces it with the authenticated caller.

---

## `GET /api/scenarios`

Paginated, newest first.

| Parameter | Type | Default |
| --- | --- | --- |
| `search` | string | — |
| `page` | integer ≥ 1 | `1` |
| `pageSize` | integer 1–100 | `20` |

`search` is a case-insensitive substring match on `name`.

`data` is the array itself, with `page`, `pageSize` and `total` in `meta` — the same shape as `GET /api/planning/runs`.

---

## `GET /api/scenarios/:id`

One scenario, the same shape the POST returned. `404` when the id is unknown.

### `planningRunCount`

How many planning runs reference this scenario. `0` means it has been defined but never tested — the run that would prove it does not exist yet. It counts runs in every status, not just `COMPLETED`, because a scenario that only ever produced failures is a fact worth seeing.

---

## Using one

```
POST /api/scenarios          -> { "id": "cmt9b2c..." }
POST /api/planning/runs      { "horizonDays": 30, "scenarioId": "cmt9b2c..." }  -> 202
GET  /api/planning/runs/:id  -> poll until COMPLETED
```

`POST /api/planning/runs` already accepted `scenarioId` before this group existed and is unchanged by it — it validates the id and `404`s on an unknown one.

The seed creates one flu-surge scenario (`demandMultiplier: 1.6`, `serviceLevelTarget: 0.98`) so the scenario branch has test data without anything being created first.
