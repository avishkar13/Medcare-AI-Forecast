# Inventory API

Mounted at `/api/inventory` (`src/routes/inventory_route.ts`). Both routes are `GET`, open, and rate limited on the `read` tier.

Shared conventions — response envelope, error codes, headers and rate limits — are in [`conventions.api.md`](conventions.api.md) and not repeated here.

The dashboard answers "how is the network doing". This route group answers "show me the rows behind that number": one record per **position**, meaning a product held at a warehouse. Forty products across four DCs is 160 positions.

---

## `GET /api/inventory`

The inventory table: every position, filtered, sorted and paginated, with totals for the filtered set.

### Request

| Parameter | Type | Default | Notes |
| --- | --- | --- | --- |
| `search` | string | — | Case-insensitive substring, matched against **either** `sku` or `productName` |
| `category` | string | — | Exact match |
| `warehouse` | string | — | Accepts the warehouse **cuid**, its **code** (`DC-01`) or its **name** (`Northeast DC`). Code and name are case-insensitive. Unknown value is `404`. |
| `criticality` | `LOW` \| `MEDIUM` \| `HIGH` \| `CRITICAL` | — | Exact match |
| `status` | see [status](#status--one-per-position) | — | Exact match |
| `risk` | `critical` \| `high` \| `medium` \| `low` | — | Exact match |
| `sort` | `sku` \| `risk` \| `daysOfSupply` \| `inventoryValue` | `sku` | Each key has one sensible direction — see below |
| `page` | integer ≥ 1 | `1` | |
| `pageSize` | integer 1–200 | `50` | |

Sort directions are fixed rather than configurable, because only one direction is useful per key:

| `sort` | Order | Tie-break |
| --- | --- | --- |
| `sku` | ascending | `warehouseCode` ascending |
| `risk` | worst first | `inventoryValue` descending |
| `daysOfSupply` | fewest days first | `sku` ascending |
| `inventoryValue` | most valuable first | `sku` ascending |

Under `daysOfSupply`, positions with **no recorded demand sort last**. Their `daysOfSupply` is `0`, but that means "unknown", not "runs out tomorrow", and putting them at the top would bury the genuinely urgent rows.

### Response `200`

```json
{
  "data": {
    "items": [
      {
        "productId": "cmt6kuign000f74jd6xj8ld6i",
        "sku": "SKU-DXM-30",
        "productName": "Dextromethorphan 30mg Syrup",
        "category": "Respiratory",
        "criticality": "MEDIUM",
        "warehouseId": "cmt6kui8o000174jduxbwkuug",
        "warehouseCode": "DC-01",
        "warehouseName": "Northeast DC",
        "tier": "METRO",
        "onHand": 6339,
        "reserved": 427,
        "inTransit": 0,
        "available": 5912,
        "safetyStock": 394.33,
        "reorderPoint": 1446.5,
        "maximumInventory": 6401,
        "avgDailyDemand": 95.65,
        "leadTimeDays": 11,
        "daysOfSupply": 66.3,
        "unitCost": 1.2,
        "inventoryValue": 7606.8,
        "expiringUnits": 2533,
        "expiringValue": 3039.6,
        "daysToNearestExpiry": 10,
        "status": "expiringSoon",
        "risk": "critical"
      }
    ],
    "totals": {
      "positionCount": 160,
      "skuCount": 40,
      "warehouseCount": 4,
      "onHandUnits": 429523,
      "inventoryValue": 321181.76,
      "belowSafetyStockCount": 4,
      "belowReorderPointCount": 39,
      "aboveMaximumCount": 58,
      "expiringValue": 165388.56
    }
  },
  "meta": { "generatedAt": "…", "page": 1, "pageSize": 50, "total": 160 }
}
```

`items` is the current page. **`totals` covers every position matching the filter**, so a client can show "showing 50 of 160, $321,182 on hand" without fetching the rest. With no filters, `totals.inventoryValue` equals `/dashboard/summary`'s `kpis.totalInventoryValue` — the two routes compute it independently and must agree.

### Fields

| Field | Type | Notes |
| --- | --- | --- |
| `onHand` | number | Physical units on the shelf |
| `reserved` | number | Committed to orders not yet shipped |
| `available` | number | `onHand − reserved` — what can actually be promised |
| `inTransit` | number | On its way in, not yet counted in `onHand` |
| `safetyStock` | number | Computed, not stored. See the maths in `dashboard.api.md`. |
| `reorderPoint` | number | Computed. `onHand` below this is the replenishment trigger. |
| `maximumInventory` | number \| null | From `PlanningParameter`; `null` when no row exists, in which case the position can never count as excess |
| `avgDailyDemand` | number | Mean daily demand over the last 90 days, this product at this warehouse |
| `daysOfSupply` | number | `onHand / avgDailyDemand`, or `0` when there is no demand history |
| `expiringUnits` / `expiringValue` | number | Units and value in batches expiring within **90 days** |
| `daysToNearestExpiry` | number \| null | Soonest-expiring batch at this position; `null` when nothing expires inside the horizon. **Can be negative** for stock already past date. |

### `status` — one per position

Every position lands in exactly one state, evaluated in priority order, first match wins. Identical to the `breakdown` block of `/dashboard/inventory-health`, so the counts here and there agree.

| Order | `status` | Condition |
| --- | --- | --- |
| 1 | `criticalStock` | `onHand < safetyStock` |
| 2 | `belowReorderPoint` | `onHand < reorderPoint` |
| 3 | `expiringSoon` | Holds a batch expiring within 30 days |
| 4 | `excessStock` | `onHand > maximumInventory` |
| 5 | `healthy` | None of the above |

### `risk` — the worst thing about the position

`status` says which problem is most urgent; `risk` says how bad the position is overall. It is the worst level across three independent dimensions, so a healthy-looking position holding stock that expires next week still reads `critical`.

| Dimension | critical | high | medium |
| --- | --- | --- | --- |
| Stockout | `onHand < safetyStock` | `onHand < reorderPoint` | — |
| Expiry | nearest batch ≤ 15 days | ≤ 30 days | ≤ 60 days |
| Excess | — | — | `onHand > maximumInventory` |

Anything that trips nothing is `low`. The expiry bands are the same ones `/dashboard/expiry-risk` applies to individual batches.

### Errors

| Status | When |
| --- | --- |
| `404 NOT_FOUND` | `warehouse` matches no cuid, code or name |
| `422 VALIDATION_FAILED` | Unrecognised `status`, `risk`, `sort` or `criticality`; `pageSize` above 200; `page` below 1 |

An unknown warehouse is a `404` rather than an empty list, because a filter that silently matches nothing is indistinguishable from a warehouse with no stock.

---

## `GET /api/inventory/:id`

One product across the whole network: its positions, its batches, and totals over both. This is the drill-down behind a row in the table.

### Request

| Parameter | Type | Notes |
| --- | --- | --- |
| `id` | string | Accepts **either** the product cuid or the SKU — `/api/inventory/SKU-LIS-10` and `/api/inventory/cmt6kuign0007…` both resolve |

### Response `200`

```json
{
  "data": {
    "product": {
      "id": "cmt6kuign000774jdjppd31q6",
      "sku": "SKU-LIS-10",
      "name": "Lisinopril 10mg Tablets",
      "category": "Cardiovascular",
      "unit": "unit",
      "unitCost": 0.22,
      "shelfLifeDays": 730,
      "criticality": "CRITICAL",
      "isActive": true
    },
    "totals": {
      "positionCount": 4,
      "skuCount": 1,
      "warehouseCount": 4,
      "onHandUnits": 14148,
      "inventoryValue": 3112.56,
      "belowSafetyStockCount": 0,
      "belowReorderPointCount": 2,
      "aboveMaximumCount": 2,
      "expiringValue": 2391.4
    },
    "positions": [{ "warehouseCode": "DC-01", "onHand": 5518, "status": "excessStock", "risk": "medium", "…": "…" }],
    "batches": [
      {
        "batchId": "cmt6kv1k90mmn74jdxeu4pfe2",
        "batchNumber": "B-LIS-021",
        "warehouseId": "cmt6kui8o000274jd8kiva1ve",
        "warehouseCode": "DC-02",
        "warehouseName": "South DC",
        "quantity": 746,
        "unitCost": 0.22,
        "valueAtRisk": 164.12,
        "manufacturingDate": "2024-08-29T00:00:00.000Z",
        "expiryDate": "2026-08-29T00:00:00.000Z",
        "daysToExpiry": 5,
        "severity": "critical"
      }
    ]
  },
  "meta": { "generatedAt": "…" }
}
```

- `positions` uses the same item shape as the list route, ordered by `warehouseCode`. One entry per warehouse holding the product.
- `totals` covers those positions, so `skuCount` is always `1`.
- `batches` is **every** batch with stock remaining, ordered soonest-expiring first — not just the ones inside the 90-day horizon, because the drawer shows the full lot picture. `valueAtRisk` is the batch's full value, not an expected loss; for the FEFO projection of what will actually be wasted, use `/dashboard/expiry-risk`.
- A product that exists but holds no stock returns `200` with empty `positions` and `batches` and zeroed totals. Only an unknown product is a `404`.

### Errors

| Status | When |
| --- | --- |
| `404 NOT_FOUND` | Neither the cuid nor the SKU matches a product |

### Not available yet

The stock-movement history a drawer might show has no backing table — there is no movement or ledger model in the schema, and inventory is stored as a current balance. Nothing here fabricates one.
