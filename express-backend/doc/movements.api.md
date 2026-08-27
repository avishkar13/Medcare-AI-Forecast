# Movements, DC sync and restock requests

The execution loop — the half of the product that writes rather than reads. Phase 3.

Conventions (envelope, errors, headers, rate-limit tiers) are in [`conventions.api.md`](conventions.api.md)
and are not repeated here.

---

## The one rule worth reading first

`quantity` means two different things on the way in and on the way out, on purpose.

| | Shape | Why |
| --- | --- | --- |
| **Request** | a **positive magnitude** (`{ "movementType": "SALE", "quantity": 180 }`) | The type already carries the direction. Asking a caller to also sign it is how a receipt gets recorded as a sale. |
| **Response / ledger** | a **signed delta** (`quantity: -180`) | Makes `stockAfter === stockBefore + quantity` true of every row, so a client renders the ledger without knowing which types subtract. |

A signed quantity on a directional type is **rejected with `400`**, not interpreted:
`{ "movementType": "RECEIPT", "quantity": -180 }` reads equally as "receive 180" and
"reverse a receipt", and guessing between them moves stock the wrong way.

`ADJUSTMENT` is the single exception and takes a signed value, because a stock count can
correct in either direction and that is the user's call, not the type's.

**Movement types:** `SALE`, `RECEIPT`, `TRANSFER_IN`, `TRANSFER_OUT`, `RETURN`,
`WASTAGE`, `ADJUSTMENT`. Only `SALE` counts as realised demand and appends to
`DemandHistory`.

---

## `POST /api/dc/:code/movements`

Records one movement. **This is the only route in the product that changes stock.**

`:code` is a warehouse code or id. Rate limit: `write` (30/min) — a DC terminal records
many movements a shift, so the `expensive` tier would stop a real one dead.
Permission: `inventory:adjust`.

**Send `Idempotency-Key`.** A retried POST is the normal case on a flaky connection, and
without the key the same sale applies twice and the position is silently wrong. Mint one
per user action, not per attempt. A replay answers `200` with the original movement and
raises no new alerts; a first write answers `201`.

### Request

```json
{
  "sku": "MED001",
  "movementType": "SALE",
  "quantity": 180,
  "reference": "POS-4471",
  "notes": "counter sale",
  "fromLocation": "shelf-A",
  "toLocation": null,
  "date": "2026-08-27T10:32:00.000Z"
}
```

Only `sku`, `movementType` and `quantity` are required; `date` defaults to now. The body
is **strict** — an unknown key is `422` rather than silently dropped, because a dropped
field looks like the movement recorded something it did not.

`restockRequestId` closes an approved restock request against this arrival — see
[Restock requests](#restock-requests). It is ignored on an outward movement: a sale does
not fulfil a request for more stock.

### Response `201`

```json
{
  "data": {
    "movement": {
      "id": "cmt…", "date": "2026-08-27T10:32:00.000Z", "movementType": "SALE",
      "sku": "MED001", "productId": "cmt…", "productName": "Paracetamol 500mg",
      "warehouseId": "cmt…", "dc": "DEL", "warehouseName": "Delhi DC",
      "quantity": -180, "stockBefore": 500, "stockAfter": 320,
      "fromLocation": "shelf-A", "toLocation": null,
      "reference": "POS-4471", "userOrSystem": "cmt…",
      "triggeredAlertId": "cmt…", "createdAt": "…"
    },
    "inventory": {
      "productId": "cmt…", "warehouseId": "cmt…",
      "onHand": 320, "reserved": 0, "inTransit": 0, "available": 320, "updatedAt": "…"
    },
    "alertsRaised": [
      { "id": "cmt…", "severity": "critical", "type": "stockout_risk", "title": "…" }
    ],
    "restockRequest": null,
    "clamped": false
  }
}
```

### What it does, in order

1. **One transaction:** reads the position (creating it if the DC has never held this
   SKU), writes the ledger row, updates `Inventory`, appends `DemandHistory` for a
   `SALE`, and stamps `Warehouse.lastSyncedAt`.
2. **Then, outside it:** re-runs `refreshAlerts()` and records which alert the movement
   raised.

Detection is outside the transaction deliberately — holding one open across a full cycle
would block every other writer for seconds. It is *synchronous* so the response can
carry `alertsRaised`, which costs roughly 1–3s per movement on the seeded network.

### Stock never goes negative

Selling more than exists clamps at zero, and the row stores **the delta that actually
happened**, not the one requested — so `stockAfter === stockBefore + quantity` still
holds. `clamped: true` tells the caller the full quantity did not move; a silent clamp
would leave them believing it did.

### Errors

| Status | When |
| --- | --- |
| `400` | A signed quantity on a directional type, or a zero quantity |
| `404` | Unknown `sku` or unknown DC |
| `409` | A request with this `Idempotency-Key` is still in flight |
| `422` | An unknown body key, or a malformed field |

---

## `GET /api/inventory/movements`

The ledger. Newest first, then by id — two movements can share a timestamp to the
millisecond, and an unstable order makes paging drop or repeat rows.

| Parameter | Meaning |
| --- | --- |
| `dc` / `warehouse` | Warehouse id, code or name |
| `sku` | Product id or SKU |
| `type` | One movement type |
| `from`, `to` | Date range over `date` |
| `page`, `pageSize` | Max 200 |

Each row carries `triggeredAlertId`, so "this transaction caused this alert" is a link
rather than a guess.

---

## `GET /api/dc/:code/sync`

What a DC last reported. Makes "the hub connects the DCs" literal rather than narrative.

```json
{
  "data": {
    "warehouseId": "cmt…", "code": "DEL", "name": "Delhi DC", "isActive": true,
    "lastSyncedAt": "2026-08-27T10:32:00.000Z", "minutesSinceSync": 4,
    "status": "live", "movementsToday": 12,
    "positionsHeld": 40, "onHandUnits": 18422,
    "lastMovement": { "…": "the same shape as the ledger" }
  }
}
```

`status` is `never` until the DC has reported once — **not** `stale`, which would imply
it used to report and stopped. `stale` means the last report is over a day old.

---

## `GET /api/planning/runs/:id/inventory-plans`

The projection curve. The executor has written `InventoryPlan` per position per day
since Phase C and nothing read it until now.

**This is a read.** It does not recompute a stage — recomputing a slice in isolation
plans against stale inventory, which is why Phase D rejected per-stage write endpoints.

Filters: `sku`, `warehouse`. `scope` reports what you got: `position` is one readable
curve, `aggregate` is every pair overlaid, which no chart can render honestly.

**Narrow it.** A run holds ~4,800 plan rows and as many forecasts. Given both `sku` and
`warehouse` you get that position's curve, its forecast band and its `stockoutDate`.
Without both you get `scope: "aggregate"`, a bounded sample of at most 500 points, **no
band** (a p10–p90 is a statement about one pair and means nothing summed across the
network) and `stockoutDate: null` (the first day *some* pair hits zero is not a date
anyone can act on).

```json
{
  "data": {
    "planningRunId": "cmt…", "status": "COMPLETED", "horizonDays": 30,
    "scope": "position",
    "points": [{
      "date": "2026-08-28", "projectedOnHand": 412, "openingInventory": 500,
      "forecastDemand": 88, "safetyStock": 240, "reorderPoint": 400,
      "netRequirement": 0, "daysOfSupply": 4.7,
      "p10": 71, "p50": 88, "p90": 104
    }],
    "stockoutDate": "2026-09-02"
  }
}
```

`p10`/`p50`/`p90` come from `Forecast`, not `InventoryPlan`, which stores only the p50 it
planned against. They are **null** when the run produced no forecast row for that day — a
fallback run can plan more days than it forecast, and a fabricated band is worse than a
gap. `stockoutDate` is the first day the curve crosses zero, read off the points rather
than recomputed.

---

## Restock requests

A human asking for stock, as distinct from a `SupplyPlan`, which the executor proposes.
Both mean "something should arrive here", but only one can be argued with, so they are
separate tables rather than a flag on one.

```
REQUESTED ─┬─> APPROVED ──> FULFILLED
           └─> REJECTED
```

**Nothing here moves stock.** `FULFILLED` is reached by recording the arriving movement
with `restockRequestId` in its body — the stock arriving *is* the event, not a button
that claims stock arrived without any arriving. That keeps the same boundary the
executor respects, and the movement response carries the closed request back.

Only an inward movement can fulfil one, and only an `APPROVED` request can be fulfilled:
fulfilling a `REQUESTED` one would record stock against a decision nobody made, and a
`REJECTED` one would contradict the rejection.

| Route | Notes |
| --- | --- |
| `GET /api/restock-requests` | Filters `warehouse`, `sku`, `status`; paginated. Open requests first, then newest — a review surface is about what still needs deciding |
| `POST /api/restock-requests` | `{ sku, warehouse, quantity, reason?, notes? }`; `quantity` positive |
| `PATCH /api/restock-requests/:id/approve` | `REQUESTED` only |
| `PATCH /api/restock-requests/:id/reject` | `REQUESTED` only |

A decided request answers `409` on a second decision, matching the supply-plan and
recommendation lifecycles.

---

## DC scoping

Every route here is scoped like the rest of the API: a caller confined to a DC is
narrowed to it whether or not they ask, and asking for another DC is `403`. On
`POST /api/dc/:code/movements` the DC is in the **path**, so that is what the guard
checks.
