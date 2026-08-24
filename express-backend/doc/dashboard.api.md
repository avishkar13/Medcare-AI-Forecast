# Dashboard API

Mounted at `/api/dashboard` (`src/routes/dashboard_route.ts`). All routes are `GET`, open, and rate limited on the `read` tier.

Shared conventions — response envelope, error codes, headers and rate limits — are in [`conventions.api.md`](conventions.api.md) and not repeated here.

## Route status

| Route | Answers | Status |
| --- | --- | --- |
| `GET /summary` | How is the network doing overall? | **complete** |
| `GET /network` | Where does inventory sit, and which DCs are exposed? | **complete** |
| `GET /inventory-health` | How is stock distributed across health states? | **complete** |
| `GET /expiry-risk` | Which batches will expire, and what are they worth? | **complete** |
| `GET /priority-actions` | What needs a human decision today? | **complete** |

---

## `GET /api/dashboard/summary`

The above-the-fold block. Returns both payloads in one response because the two panels always render together and neither takes a filter.

### Request

No parameters.

### Response `200`

```json
{
  "data": {
    "kpis": {
      "totalInventoryValue": 321181.76,
      "skusMonitored": 40,
      "stockoutRiskItems": 39,
      "expiryRiskItems": 133,
      "onTimeDeliveryRate": null,
      "forecastAccuracy": null,
      "activeAlerts": 36,
      "pendingRecommendations": 0
    },
    "networkHealth": {
      "overallScore": 69,
      "inStockPercentage": 75.63,
      "atRiskSkuCount": 4,
      "excessInventoryValue": 52960.93,
      "shortageValue": 4413.16
    }
  },
  "meta": { "generatedAt": "2026-08-24T01:49:18.840Z" }
}
```

### `kpis`

| Field | Type | How it is computed |
| --- | --- | --- |
| `totalInventoryValue` | number | `Σ (onHand × unitCost)` across all 160 product/warehouse positions |
| `skusMonitored` | number | Distinct products holding an inventory row |
| `stockoutRiskItems` | number | Positions where `onHand < reorderPoint` |
| `expiryRiskItems` | number | `InventoryBatch` rows with `quantity > 0` expiring within **90 days** — counts batches, not SKUs |
| `onTimeDeliveryRate` | number \| **null** | Always `null`. No purchase-order or delivery model exists in the schema. |
| `forecastAccuracy` | number \| **null** | Always `null` until a `PlanningRun` completes — needs realized-vs-forecast history. |
| `activeAlerts` | number | Positions below safety stock **plus** batches expiring within 30 days |
| `pendingRecommendations` | number | `Recommendation` rows with `status = OPEN`. `0` until the planning engine runs. |

> **Two fields are always `null` this phase.** Clients must type them as `number | null` and render an explicit "not yet available" state. Returning a fabricated percentage was rejected.

### `networkHealth`

| Field | Type | How it is computed |
| --- | --- | --- |
| `overallScore` | number 0–100 | `100 − 0.5×stockoutShare − 0.3×expiryShare − 0.2×excessShare`, floored at 0, rounded to integer |
| `inStockPercentage` | number | Percentage of positions where `onHand ≥ reorderPoint` |
| `atRiskSkuCount` | number | Positions where `onHand < safetyStock` — a stricter bar than `stockoutRiskItems` |
| `excessInventoryValue` | number | `Σ max(0, onHand − maximumInventory) × unitCost` |
| `shortageValue` | number | `Σ max(0, reorderPoint − onHand) × unitCost` |

Where `stockoutShare` is the percentage of positions below reorder point, `expiryShare` the percentage of total inventory value expiring within 90 days, and `excessShare` the percentage of total value above maximum.

### Underlying inventory maths

Every position is computed from a 90-day demand window, not stored:

```
safetyStock  = z(serviceLevel) × √( leadTimeDays × σ²demand  +  μ²demand × σ²leadTime )
reorderPoint = μdemand × leadTimeDays + safetyStock
daysOfSupply = onHand / μdemand
```

- `μdemand`, `σdemand` — mean and sample standard deviation of `DemandHistory.orderedQuantity` over the last 90 days, per product/warehouse.
- `leadTimeDays`, `σleadTime`, `serviceLevel` — from `PlanningParameter`; defaults `7`, `0`, `0.95` if no row exists.
- `z()` — inverse normal CDF, Acklam approximation, in `src/utils/inventory.ts`.

`orderedQuantity` is used rather than `fulfilledQuantity` deliberately: it is demand as the customer expressed it, unclipped by whatever stock happened to be on hand.

### Errors

No parameters means no `422`. A database outage surfaces as `503 DATABASE_UNAVAILABLE` through the shared error handler.

### Performance

Three queries in parallel: `loadPositions()`, `loadExpiringBatches()`, and one `Recommendation` count. `loadPositions` is itself three parallel queries — inventory with joins, planning parameters, and one raw aggregate over `DemandHistory`. The 28,800-row demand table is reduced to 160 rows inside Postgres by `GROUP BY`, never loaded into Node.

`expiryRiskItems` and `activeAlerts` are derived from the already-loaded batch array rather than from separate `count` queries.

---

## `GET /api/dashboard/network`

Per-warehouse position. Answers where inventory sits and which distribution centres are exposed — the metro-excess versus Tier-2-shortage split the brief describes.

### Request

| Parameter | Type | Notes |
| --- | --- | --- |
| `tier` | `METRO` \| `TIER_1` \| `TIER_2` \| `TIER_3` | Optional. Exact match; any other value is `422`. |

Returns one row per warehouse, ordered by `code` ascending. Not paginated — the network is a fixed set of distribution centres.

### Response `200`

```json
{
  "data": [
    {
      "id": "cmt6kui8o000174jduxbwkuug",
      "code": "DC-01",
      "name": "Northeast DC",
      "region": "Northeast",
      "tier": "METRO",
      "capacity": 500000,
      "skuCount": 40,
      "onHandUnits": 182422,
      "utilization": 36.48,
      "inventoryValue": 128166.59,
      "belowReorderPointCount": 0,
      "belowSafetyStockCount": 0,
      "stockoutRisk": 0,
      "shortageValue": 0,
      "excessValue": 15380.57,
      "expiringValue": 44046.4
    }
  ],
  "meta": { "generatedAt": "2026-08-24T02:48:28.084Z" }
}
```

### Fields

| Field | Type | How it is computed |
| --- | --- | --- |
| `id` | string | Warehouse cuid |
| `code` | string | Stable business identifier (`DC-01`) |
| `region`, `tier` | string \| null | From `Warehouse` |
| `capacity` | number \| null | Units. Nullable — capacity is optional on `Warehouse`. |
| `skuCount` | number | Products holding an inventory row at this DC |
| `onHandUnits` | number | `Σ onHand` |
| `utilization` | number \| **null** | `onHandUnits / capacity × 100`. **`null` when `capacity` is null** — not `0`, since unknown capacity is not zero capacity. |
| `inventoryValue` | number | `Σ (onHand × unitCost)` |
| `belowReorderPointCount` | number | Positions where `onHand < reorderPoint` — the replenishment trigger |
| `belowSafetyStockCount` | number | Positions where `onHand < safetyStock` — the stricter, more urgent bar |
| `stockoutRisk` | number | `belowSafetyStockCount / skuCount × 100` |
| `shortageValue` | number | `Σ max(0, reorderPoint − onHand) × unitCost` — cost to bring every position back to its trigger |
| `excessValue` | number | `Σ max(0, onHand − maximumInventory) × unitCost` — capital tied up above the ceiling |
| `expiringValue` | number | Value of `InventoryBatch` rows at this DC expiring within **90 days** |

`shortageValue` and `excessValue` are the two halves of the brief's problem, side by side per DC. A network in balance has both near zero; this one does not.

### Reading the current data

| DC | Tier | Below reorder | Excess | Expiring |
| --- | --- | --- | --- | --- |
| DC-01 Northeast | METRO | 0 | $15,381 | $44,046 |
| DC-02 South | TIER_1 | 16 | $0 | $13,935 |
| DC-03 West Coast | METRO | 0 | $37,580 | $101,367 |
| DC-04 Midwest | TIER_2 | 23 | $0 | $6,040 |

Both METRO sites have zero positions below reorder point and hold all of the network's excess and most of its expiring value. Both lower-tier sites carry all 39 below-reorder positions and no excess at all. That is the brief's failure mode reproduced exactly: siloed regional warehouses, expiry-blind allocation, wastage and lost sales at the same time.

### Errors

`422 VALIDATION_FAILED` for an unrecognised `tier`.

### Performance

Three queries in parallel: `loadPositions()`, the warehouse list, and the expiring-batch scan. Positions are bucketed by warehouse into a `Map` in one pass, then each warehouse reduces over its own bucket — O(positions), not O(positions × warehouses).

---

## `GET /api/dashboard/inventory-health`

How stock is distributed across health states, and which therapeutic categories and criticality bands carry the risk.

### Request

| Parameter | Type | Notes |
| --- | --- | --- |
| `warehouseId` | string | Optional warehouse **cuid**. Scopes every figure to one DC. Unknown id is `404`; empty string is `422`. |

Omit `warehouseId` for the whole network.

### Response `200`

```json
{
  "data": {
    "breakdown": {
      "criticalStock": 4,
      "belowReorderPoint": 35,
      "expiringSoon": 24,
      "excessStock": 49,
      "healthy": 48,
      "total": 160
    },
    "conditions": {
      "belowSafetyStock": 4,
      "belowReorderPoint": 39,
      "aboveMaximum": 58,
      "expiringWithin30Days": 32,
      "expiringWithin90Days": 133
    },
    "byCategory": [
      {
        "category": "Respiratory",
        "skuCount": 20,
        "inventoryValue": 141714.68,
        "atRiskCount": 3,
        "expiringValue": 64075.61
      }
    ],
    "byCriticality": [
      { "criticality": "CRITICAL", "skuCount": 40, "atRiskCount": 8, "stockoutRisk": 2.5 }
    ]
  },
  "meta": { "generatedAt": "2026-08-24T03:42:56.248Z" }
}
```

### `breakdown` — mutually exclusive

Each position lands in **exactly one** state, so the five counts always sum to `total`. States are evaluated in this priority order, first match wins:

| Order | State | Condition |
| --- | --- | --- |
| 1 | `criticalStock` | `onHand < safetyStock` — the variability buffer is gone |
| 2 | `belowReorderPoint` | `onHand < reorderPoint` — routine replenishment trigger |
| 3 | `expiringSoon` | Holds a batch expiring within **30 days** |
| 4 | `excessStock` | `onHand > maximumInventory` |
| 5 | `healthy` | None of the above |

Shortage outranks expiry because a stockout of a critical pharmaceutical is a patient-safety event while expiry is a write-off. Expiry outranks excess because it is the more urgent of the two overstock problems — expiring stock must be moved or lost, plain excess merely ties up capital.

### `conditions` — independent, overlapping

The same positions counted **without** priority. A position appears in every condition it meets.

| Field | Condition |
| --- | --- |
| `belowSafetyStock` | `onHand < safetyStock` |
| `belowReorderPoint` | `onHand < reorderPoint` |
| `aboveMaximum` | `onHand > maximumInventory` |
| `expiringWithin30Days` | Batch count, not position count |
| `expiringWithin90Days` | Batch count, not position count |

**These deliberately disagree with `breakdown`, and the gap is the point.**

- `conditions.belowReorderPoint` is **39**, `breakdown.belowReorderPoint` is **35**. The 4 missing positions are also below safety stock, so they were claimed by the higher-priority `criticalStock` bucket.
- `conditions.aboveMaximum` is **58**, `breakdown.excessStock` is **49**. The 9 missing positions also hold stock expiring within 30 days — they are counted as `expiringSoon`.

Read `breakdown` to ask "what is the single worst thing about each position". Read `conditions` to ask "how many positions have this problem at all". A client that shows only `breakdown` will under-report every non-top-priority condition.

> The two expiry conditions count **batches**, everything else counts **positions** (product × warehouse). A single position can contribute several expiring batches.

### `byCategory`

One row per `Product.category`, sorted by `inventoryValue` descending. Products with no category are grouped under `"Uncategorized"`.

| Field | Notes |
| --- | --- |
| `skuCount` | Positions in this category, not distinct products |
| `inventoryValue` | `Σ (onHand × unitCost)` |
| `atRiskCount` | Positions below reorder point |
| `expiringValue` | Value expiring within 90 days |

### `byCriticality`

One row per `Product.criticality`, always ordered `CRITICAL → HIGH → MEDIUM → LOW`. Levels with no positions are omitted rather than returned as zero rows.

| Field | Notes |
| --- | --- |
| `atRiskCount` | Positions below reorder point |
| `stockoutRisk` | Percentage below **safety stock** — the stricter bar, consistent with `/network` |

This is the direct answer to the brief's "reduce stock-outs of critical SKUs": if `CRITICAL` shows a higher `stockoutRisk` than `LOW`, protection is being applied to the wrong products.

### Errors

| Status | When |
| --- | --- |
| `404 NOT_FOUND` | `warehouseId` does not match a warehouse |
| `422 VALIDATION_FAILED` | `warehouseId` present but empty |

### Performance

Two queries in parallel — `loadPositions()` and `loadExpiringBatches()` — plus one `count` when `warehouseId` is supplied, to distinguish "no such warehouse" from "warehouse with no stock". Scoping filters the loaded arrays in memory rather than re-querying.

---

## `GET /api/dashboard/expiry-risk`

Batch-level expiry exposure, ranked by urgency, with a FEFO-aware projection of how much will actually be wasted.

This is the only dashboard route that works at batch granularity rather than position granularity, so it queries `InventoryBatch` directly instead of projecting `loadPositions()`.

### Request

| Parameter | Type | Default | Notes |
| --- | --- | --- | --- |
| `withinDays` | integer 1–365 | `90` | Expiry horizon |
| `warehouseId` | string | — | Warehouse **cuid**. Unknown id is `404`. |
| `sku` | string | — | Exact SKU. Unknown SKU is `404`. |
| `severity` | `critical` \| `high` \| `medium` \| `low` | — | Applied after severity is computed |
| `page` | integer ≥ 1 | `1` | |
| `pageSize` | integer 1–100 | `20` | |

Ordered by `daysToExpiry` ascending, ties broken by `valueAtRisk` descending — most urgent and most expensive first.

### Response `200`

```json
{
  "data": {
    "items": [
      {
        "batchId": "cmt6kv1k90mmn74jdxeu4pfe2",
        "batchNumber": "B-LIS-021",
        "productId": "cmt6kuign000774jdjppd31q6",
        "sku": "SKU-LIS-10",
        "productName": "Lisinopril 10mg Tablets",
        "category": "Cardiovascular",
        "criticality": "CRITICAL",
        "warehouseId": "cmt6kui8o000274jd8kiva1ve",
        "warehouseCode": "DC-02",
        "warehouseName": "South DC",
        "tier": "TIER_1",
        "quantity": 746,
        "unitCost": 0.22,
        "valueAtRisk": 164.12,
        "expiryDate": "2026-08-29T00:00:00.000Z",
        "daysToExpiry": 5,
        "severity": "critical",
        "avgDailyDemand": 60.36,
        "projectedWaste": 444.2,
        "projectedWasteValue": 97.72
      }
    ],
    "totals": {
      "batchCount": 133,
      "quantity": 171465,
      "valueAtRisk": 165388.56,
      "projectedWaste": 41726.88,
      "projectedWasteValue": 62343.28
    }
  },
  "meta": { "generatedAt": "…", "page": 1, "pageSize": 3, "total": 133 }
}
```

`items` is the current page. **`totals` covers every batch matching the filter, not just the page** — so a client can show "showing 20 of 133, $62,343 projected waste" without fetching everything.

### Item fields

| Field | Type | Notes |
| --- | --- | --- |
| `batchId` | string | `InventoryBatch` cuid |
| `batchNumber` | string | Human batch label, not unique across warehouses |
| `quantity` | number | Units in this batch |
| `valueAtRisk` | number | `quantity × unitCost` — the full value of the batch, **not** the expected loss |
| `expiryDate` | string | ISO 8601 |
| `daysToExpiry` | number | Calendar days from now, rounded up. **Can be negative** for already-expired stock. |
| `severity` | enum | From `daysToExpiry` alone — see bands below |
| `avgDailyDemand` | number | Mean daily demand for this product at this warehouse, 90-day window |
| `projectedWaste` | number | Units expected to expire unsold — see below |
| `projectedWasteValue` | number | `projectedWaste × unitCost` — the expected loss |

### Severity bands

| Severity | `daysToExpiry` |
| --- | --- |
| `critical` | ≤ 15 |
| `high` | 16–30 |
| `medium` | 31–60 |
| `low` | > 60 |

Severity is time only. A batch 5 days out is `critical` whether it is worth $17 or $17,000 — urgency and materiality are separate axes, and `projectedWasteValue` carries the second one.

### How `projectedWaste` is computed

`valueAtRisk` alone overstates the problem: a batch expiring in 60 days with 20 days of demand in it will be consumed long before it expires. The projection asks what will actually be left.

For each product/warehouse position, batches are walked in **FEFO order** (first-expired, first-out) and a running total of quantity ahead is kept:

```
consumableByExpiry = avgDailyDemand × max(0, daysToExpiry)
projectedWaste     = clamp( quantityAhead + quantity − consumableByExpiry,  0,  quantity )
```

`quantityAhead` is the sum of quantities in batches at the same position expiring sooner. They are dispensed first under FEFO, so they consume the demand available to this batch.

Worked from the example above: `746 − (60.36 × 5) = 746 − 301.8 = 444.2`. Nothing expires sooner at that position, so `quantityAhead` is 0.

**Assumptions, stated plainly:**

- **Strict FEFO dispensing.** Real warehouses deviate.
- **Flat demand at the 90-day historical mean.** No seasonality is applied forward, so a batch expiring during a flu peak has its waste over-estimated. Once `Forecast` rows exist, this should switch to forecast demand over the batch's remaining life.
- **No transfers.** Stock is assumed to be consumed where it sits. This is the number a DRP transfer is meant to *reduce*, so it is deliberately the do-nothing baseline.
- **Position-local.** Demand at other warehouses cannot rescue this batch.

Read `projectedWaste` as "what is lost if nothing changes", which is exactly the baseline the brief's expiry-aware allocation is measured against.

### Errors

| Status | When |
| --- | --- |
| `404 NOT_FOUND` | `warehouseId` or `sku` does not exist |
| `422 VALIDATION_FAILED` | `withinDays` outside 1–365, `pageSize` above 100, `page` below 1, unrecognised `severity` |

The `sku` check runs only when the filter matched nothing, so a valid SKU with no expiring batches returns an empty list rather than a 404.

### Current data

| Severity | Batches |
| --- | --- |
| critical | 17 |
| high | 15 |
| medium | 38 |
| low | 63 |
| **total** | **133** |

$165,389 of inventory sits inside the 90-day horizon; $62,343 of it is projected to be wasted if nothing moves.

### Performance

Two queries in parallel — `loadPositions()` for demand rates, and the batch query with `product` and `warehouse` joined. FEFO accumulation is a single pass in `expiryDate` order (which the database supplies), so the whole projection is O(batches). Filtering by `severity` and paginating happen in memory, since severity is derived and cannot be expressed in SQL without duplicating the band logic.

---

## `GET /api/dashboard/priority-actions`

A ranked worklist: what needs a human decision today, and what to do about it.

This is a **rules engine over current state**, not planning-engine output. It needs no `PlanningRun` and works today. Five rules fire; each action names both the problem and a concrete recommended action.

### Request

| Parameter | Type | Default | Notes |
| --- | --- | --- | --- |
| `warehouseId` | string | — | Warehouse **cuid**. For transfers this matches the **destination**. Unknown id is `404`. |
| `severity` | `critical` \| `high` \| `medium` \| `low` | — | |
| `type` | see rule table | — | Unrecognised value is `422` |
| `limit` | integer 1–50 | `10` | |

Ordered by severity, then `impactValue` descending — worst first, most expensive first within a band.

### Response `200`

```json
{
  "data": {
    "items": [
      {
        "id": "TRANSFER_OPPORTUNITY:cmt6kuign001574jd3akf21ah:cmt6kui8o000274jd8kiva1ve",
        "type": "TRANSFER_OPPORTUNITY",
        "severity": "critical",
        "sku": "SKU-HYD-100",
        "productName": "Hydrocortisone 100mg Injection",
        "criticality": "CRITICAL",
        "warehouseId": "cmt6kui8o000274jd8kiva1ve",
        "warehouseCode": "DC-02",
        "warehouseName": "South DC",
        "tier": "TIER_1",
        "problem": "215 units short at South DC while Northeast DC holds 1,662 above its maximum",
        "recommendedAction": "Transfer 215 units from Northeast DC to South DC",
        "quantity": 215,
        "impactValue": 4138.75,
        "sourceWarehouseCode": "DC-01",
        "sourceWarehouseName": "Northeast DC"
      }
    ],
    "counts": { "critical": 36, "high": 20, "medium": 12, "low": 30, "total": 98 }
  },
  "meta": { "generatedAt": "2026-08-24T05:04:00.899Z" }
}
```

`items` is capped by `limit`; **`counts` covers every action matching the filter**, so badge counts stay correct without fetching the full list.

### Fields

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | `TYPE:productId:warehouseId` — deterministic, stable across calls while the condition persists. Safe to use for client-side dismissal. |
| `warehouseId` / `warehouseCode` / `warehouseName` / `tier` | | The warehouse **the action is about**. For a transfer this is the destination. |
| `problem` | string | Human-readable statement of what is wrong, with the numbers in it |
| `recommendedAction` | string | What to do. Always concrete and quantified. |
| `quantity` | number \| null | Units to transfer, order, or redistribute. Never below 1 — see decisions. |
| `impactValue` | number | Money at stake if nothing is done. Ranking key within a severity band. |
| `sourceWarehouseCode` / `sourceWarehouseName` | string \| null | Populated only for `TRANSFER_OPPORTUNITY` |

### Rules

| `type` | Fires when | `quantity` | `impactValue` |
| --- | --- | --- | --- |
| `TRANSFER_OPPORTUNITY` | A position is below reorder point **and** another warehouse holds the same product above its maximum | Units to move | Waste avoided at source + `units × stockoutCostPerUnit` at destination |
| `STOCKOUT_IMMINENT` | Residual shortfall remains **and** `daysOfSupply ≤ leadTimeDays` — a normal order arrives after stock runs out | Shortfall | `shortfall × stockoutCostPerUnit` |
| `BELOW_REORDER_POINT` | Residual shortfall remains, resupply arrives in time | Shortfall | `shortfall × stockoutCostPerUnit` |
| `EXPIRY_WRITE_OFF` | Residual projected waste ≥ 1 unit and the earliest batch expires within 30 days | Residual waste units | `residualWaste × unitCost` |
| `EXCESS_STOCK` | Residual stock above maximum, with no expiry problem | Residual excess units | `residualExcess × unitCost` |

### Severity assignment

| Rule | critical | high | medium | low |
| --- | --- | --- | --- | --- |
| `TRANSFER_OPPORTUNITY` | `daysOfSupply ≤ leadTime` | otherwise | | |
| `STOCKOUT_IMMINENT` | product is `CRITICAL`/`HIGH` | otherwise | | |
| `BELOW_REORDER_POINT` | | product is `CRITICAL` | otherwise | |
| `EXPIRY_WRITE_OFF` | earliest batch ≤ 15 days | ≤ 30 days | | |
| `EXCESS_STOCK` | | | excess > 50% of maximum | otherwise |

### Transfers run first, and later rules see the residual

Rule evaluation is two-phase, and the ordering is the substance of this route.

**Phase 1 — matching.** For each product, shortage positions (sorted by need, largest first) are matched against surplus positions. Surplus is sorted by **projected waste descending**, then available quantity — so stock closest to expiring is drained first. That is the "expiry-aware allocation" the brief asks for: one transfer fixes a stockout at the destination *and* prevents a write-off at the source. Each destination gets at most one transfer, so one action means one shipment.

**Phase 2 — residuals.** Transfers are recorded per position as `transferredIn` / `transferredOut`, and the remaining four rules fire on what is *left*:

```
shortfall      = reorderPoint − onHand − transferredIn
residualWaste  = projectedWaste − transferredOut
residualExcess = onHand − maximumInventory − transferredOut
```

So a warehouse that donates 215 units of a 2,390-unit expiry problem still raises an `EXPIRY_WRITE_OFF` for the remaining 2,175. A destination whose shortfall is fully covered raises nothing further.

### Errors

| Status | When |
| --- | --- |
| `404 NOT_FOUND` | `warehouseId` does not exist |
| `422 VALIDATION_FAILED` | unrecognised `severity` or `type`, `limit` outside 1–50 |

### Current data

| Type | Count |
| --- | --- |
| `TRANSFER_OPPORTUNITY` | 37 |
| `EXCESS_STOCK` | 41 |
| `EXPIRY_WRITE_OFF` | 17 |
| `BELOW_REORDER_POINT` | 2 |
| `STOCKOUT_IMMINENT` | 1 |
| **total** | **98** |

37 of the network's 39 below-reorder positions can be resolved by internal transfer — only 3 need an external order. The brief's diagnosis of "siloed regional warehouses" is quantified: the stock already exists, in the wrong place.

### Performance

Two queries in parallel — `loadPositions()` and a 90-day batch scan. Matching is O(products × positions-per-product); with 40 products across 4 warehouses that is trivial. Filtering, sorting and limiting are in memory, since severity, `impactValue` and every residual are derived.
