# Planning Parameters API

Mounted at `/api/planning/parameters` (`src/routes/parameters_route.ts`). One read on the `read` tier, one write on `write`.

Shared conventions are in [`conventions.api.md`](conventions.api.md).

**These are the numbers the executor plans with.** `PlanningParameter` carried every one of them from the first migration and no route touched any: the engine planned with values a planner could neither see nor change.

`reviewPeriodDays` is the brief's **review cadence** in its most literal form — how often a replenishment order is released.

---

## `GET /api/planning/parameters`

One row per product-warehouse pair, paginated.

| Parameter | Type | Default |
| --- | --- | --- |
| `sku` | string | — (cuid or `sku`; unknown is `404`) |
| `warehouse` | string | — (cuid or `code`; unknown is `404`) |
| `page` / `pageSize` | integer | `1` / `50`, max `200` |

```json
{
  "data": [
    {
      "id": "cmt6...", "productId": "cmt6...", "sku": "SKU-AMX-500",
      "productName": "Amoxicillin 500mg", "criticality": "HIGH",
      "warehouseId": "cmt6...", "warehouseCode": "DC-01",
      "warehouseName": "Northeast DC", "tier": "METRO",
      "leadTimeDays": 9, "leadTimeStdDev": 1.5,
      "serviceLevel": 0.96, "reviewPeriodDays": 7,
      "minimumOrderQty": 120, "maximumInventory": 4800,
      "holdingCostPerUnit": 0.0004,
      "stockoutCostPerUnit": 0.9,
      "expiryCostPerUnit": 0.15
    }
  ],
  "meta": { "generatedAt": "...", "page": 1, "pageSize": 50, "total": 160 }
}
```

## `PUT /api/planning/parameters`

Upserts on the existing `@@unique([productId, warehouseId])` — creating the row if the pair has none.

**`PUT`, not `PATCH`.** Safety stock reads `leadTimeDays`, `leadTimeStdDev` and `serviceLevel` together. A partial update would let a caller raise the service level while leaving a stale lead time beside it, and the pair would be inconsistent in a way nothing downstream could detect.

| Field | Range | Default |
| --- | --- | --- |
| `sku`, `warehouse` | required | — |
| `leadTimeDays` | integer 0–365 | required |
| `leadTimeStdDev` | 0–365 | `0` |
| `serviceLevel` | 0.5–0.999 | `0.95` |
| `reviewPeriodDays` | integer 1–365 | `7` |
| `minimumOrderQty` | ≥ 0 | `0` |
| `maximumInventory` | ≥ 0 or `null` | `null` |
| `holdingCostPerUnit` | ≥ 0 | required |
| `stockoutCostPerUnit` | ≥ 0 | required |
| `expiryCostPerUnit` | ≥ 0 | required |

Unknown fields are rejected (`422`) — a misspelled `serviceLvl` would otherwise leave the old value in place while reporting success.

`serviceLevel` uses the same 0.5–0.999 band as [`Scenario.serviceLevelTarget`](scenarios.api.md), because both end up in the same z-score.

**`maximumInventory` must not be below `minimumOrderQty`** when both are set. A ceiling under the floor makes every order-up-to level unsatisfiable, and the executor would clamp to a maximum it can never legally reach.

---

## These values reach the executor

Changing `serviceLevel` changes the z-score in `safetyStock()` on the next run. There is an integration test that runs the planner at `0.8` and again at `0.99` and asserts the buffer grew — the value is not merely stored.

### A scenario's service level is an *override*

`PlanningParameter.serviceLevel` is per pair, which is the point of storing it there: a critical antibiotic at a Tier-2 DC should not plan to the same buffer as a routine SKU at a metro DC.

A run **without** a scenario uses each pair's own value. A run **with** a scenario uses that scenario's `serviceLevelTarget` for every pair, because a scenario is a deliberate network-wide "what if we targeted 98% everywhere".

This is worth stating because it was wrong: the executor read only the scenario's target, and the neutral scenario supplied a constant `0.95`, so the per-pair column was never read at all.

| Status | When |
| --- | --- |
| `200` | Read, or upserted |
| `404` | Unknown `sku` or `warehouse` |
| `422` | A value out of range, an unsatisfiable min/max pair, or an unknown field |
