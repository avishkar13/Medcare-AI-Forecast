# Expiry API

Mounted at `/api/expiry` (`src/routes/expiry_route.ts`). Six `GET` routes on the `read` tier.

Shared conventions are in [`conventions.api.md`](conventions.api.md).

Shelf-life exposure, read from `InventoryBatch`. This is the batch-level detail behind [`GET /api/dashboard/expiry-risk`](dashboard.api.md).

---

## One definition of risk

Risk bands come from **`expirySeverity()` in `src/utils/inventory.ts`** — the same function the dashboard uses. The two surfaces cannot disagree about whether a batch is critical, because there is only one implementation.

## Expired stock is excluded

Every route counts only batches with `expiryDate >= today`. **Already-expired stock is a write-off, not shelf-life *risk***, and mixing the two would inflate every exposure figure on the page.

## Shared query parameters

| Parameter | Type | Notes |
| --- | --- | --- |
| `sku` | string | Product cuid or `sku`. Unknown is `404` |
| `warehouse` | string | Warehouse cuid or `code`. Unknown is `404` |
| `withinDays` | integer 1–3650 | Only batches expiring within this many days |

---

## `GET /batches`

Paginated, **soonest expiry first** — the batches a planner can still do something about.

Adds `risk` (`critical` \| `high` \| `medium` \| `low`) and `page`/`pageSize` (default `1`/`50`, max `200`).

```json
{
  "data": [
    {
      "id": "cmt9...", "batchNumber": "B-2026-0417",
      "productId": "cmt6...", "sku": "SKU-AMX-500",
      "productName": "Amoxicillin 500mg", "criticality": "HIGH",
      "warehouseId": "cmt6...", "warehouseCode": "DC-01",
      "warehouseName": "Northeast DC", "tier": "METRO",
      "quantity": 420, "unitCost": 2.15, "inventoryValue": 903,
      "manufacturingDate": "2026-02-11", "expiryDate": "2026-09-12",
      "daysRemaining": 17, "riskLevel": "critical"
    }
  ],
  "meta": { "generatedAt": "...", "page": 1, "pageSize": 50, "total": 323 }
}
```

**`inventoryValue` is `quantity × unitCost`, reported once.** The route this replaced returned the same number three times, as `valueAtRisk`, `wasteValue` and `inventoryValue`, alongside a `demandCoverage` hardcoded to `100`.

---

## `GET /overview`

```json
{ "data": {
  "batchesTracked": 323, "totalAtRiskValue": 321181.76,
  "criticalBatches": 20, "criticalAtRiskValue": 17688.86,
  "averageDaysToExpiry": 266.74,
  "preventedWasteValue": null, "preventedWasteUnits": null
} }
```

`preventedWaste*` come from `WastePreventionRecord`. They are **`null` rather than `0`** when nothing is recorded, so "no programme yet" reads differently from "the programme saved nothing".

## `GET /timeline`

Value expiring per calendar month, soonest first: `{ month, valueExpiring, units, batchCount }`.

Only months that actually contain batches appear — an empty month is not a bucket.

## `GET /dc-exposure`

Per warehouse: `batchCount`, `totalExposureValue`, `criticalExposureValue`, ordered by exposure. Every warehouse appears, including those with none, so a DC with zero exposure is visibly zero rather than missing.

Per-DC exposure sums to `/overview`'s `totalAtRiskValue` — there is a test asserting it.

## `GET /waste-prevention`

`WastePreventionRecord` rows, newest first, with `totalUnitsSaved` and `totalValueSaved`.

## `GET /ai-assessment`

`/overview`'s figures plus `findings` — derived observations, each carrying its numbers:

```json
{ "kind": "location", "detail": "Northeast DC holds the largest exposure at 98420.5, of which 4211.2 is critical" }
```

The route this replaced returned a fixed sentence naming a warehouse and a product that had nothing to do with the data.

---

## Not implemented

`POST /batches/:id/prioritize` existed and returned `{ "success": true, "status": "prioritized" }` **while doing nothing**. There is no field on `InventoryBatch` to prioritise and no queue to add to, so it reported an action that never happened. Batch prioritisation belongs to the [recommendation lifecycle](recommendations.api.md).

## Errors

| Status | When |
| --- | --- |
| `404` | Unknown `sku` or `warehouse` |
| `422` | `withinDays`, `page`, `pageSize` or `risk` outside its bounds |
