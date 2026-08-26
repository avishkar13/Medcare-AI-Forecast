# Recommendations API

Mounted at `/api/recommendations` (`src/routes/recommendations_route.ts`). Five reads on the `read` tier, two state changes on `write`.

Shared conventions are in [`conventions.api.md`](conventions.api.md).

The review surface over what a [planning run](planning.api.md) recommended. Rows are written by the executor; nothing here creates them.

---

## Scope

Every route is scoped to **one planning run** — `runId`, defaulting to the most recent `COMPLETED` one. When no run has completed, lists are empty and counts are `0` with `planningRunId: null`.

| Parameter | Type | Notes |
| --- | --- | --- |
| `runId` | string | Defaults to the latest `COMPLETED` run. Unknown is `404` |
| `status` | `OPEN` \| `ACCEPTED` \| `REJECTED` \| `COMPLETED` | Exact match |
| `priority` | `LOW` \| `MEDIUM` \| `HIGH` \| `CRITICAL` | Exact match |
| `type` | `INCREASE_SUPPLY` \| `REDUCE_SUPPLY` \| `TRANSFER_STOCK` \| `STOCKOUT_RISK` \| `EXPIRY_RISK` | Exact match |
| `sku` | string | Product cuid or `sku`. Unknown is `404` |
| `warehouse` | string | Warehouse cuid or `code`. Unknown is `404` |
| `page` / `pageSize` | integer | `1` / `50`, max `200` |

Filters take the **enum values**, not display labels. A free-text `status=Pending` is `422` rather than a filter that silently matches nothing.

---

## `GET /api/recommendations`

Paginated list. `GET /list` is an alias, kept because it was the published path before this group was rewritten.

Ordered by **priority, then impact**: `CRITICAL` first, and within a priority the largest `impactValue` first.

```json
{
  "data": [
    {
      "id": "cmt9...", "planningRunId": "cmt9...",
      "type": "STOCKOUT_RISK", "actionType": null,
      "priority": "CRITICAL", "status": "OPEN",
      "message": "Projected shortfall of 1,240 units within lead time",
      "quantity": 1240, "confidence": null,
      "expectedImpact": null, "impactValue": 8420.5,
      "productId": "cmt6...", "sku": "SKU-AMX-500",
      "productName": "Amoxicillin 500mg", "category": "Antibiotics", "criticality": "HIGH",
      "warehouseId": "cmt6...", "warehouseCode": "DC-01",
      "warehouseName": "Northeast DC", "tier": "METRO",
      "signals": [],
      "acknowledgedAt": null, "resolvedAt": null, "actedById": null,
      "createdAt": "2026-08-26T04:11:02.118Z"
    }
  ],
  "meta": { "generatedAt": "...", "page": 1, "pageSize": 50, "total": 200 }
}
```

**Product and warehouse labels are inline**, so a list needs no second call per row.

**`confidence`, `impactValue` and `expectedImpact` are `null` when the run recorded nothing.** They are not defaulted. The route this replaced used `impactValue || 1000` and `confidence || 94`, which put money and a confidence score in front of a planner that no calculation ever produced.

---

## `GET /kpi`, `/summary`, `/impact`, `/intelligence`

| Route | Returns |
| --- | --- |
| `/kpi` | `totalRecommendations`, counts per status, `potentialSavings`, `executionRatePercent` |
| `/summary` | `byType` (count + impact), `byPriority` and `byStatus` (count) |
| `/impact` | The run's `planCost` roll-up, `attributedImpact`, and `byType` with each type's `sharePercent` |
| `/intelligence` | `modelVersion`, `horizonDays`, `averageConfidence`, `signalsCited` |

`sharePercent` is each type's share of the attributed total, so the parts add to 100. The route this replaced returned a fixed `{stockout: 45, excessInventory: 30, expiry: 15, transfers: 10}` that referred to nothing.

`averageConfidence` is the mean of the confidences actually recorded, `null` when none were. `signalsCited` counts the `RecommendationSignal` rows the executor attached — not a fixed set of model weights.

---

## `PATCH /:id/execute` and `PATCH /:id/dismiss`

Move a recommendation to `COMPLETED` or `REJECTED`. Both return the updated row in the list shape.

### The lifecycle is one-way

```
OPEN ──┬──> COMPLETED   (execute)
       └──> REJECTED    (dismiss)
ACCEPTED ──> either
```

Only `OPEN` and `ACCEPTED` are actionable. A resolved row cannot be acted on again — without that guard an already-dismissed recommendation could be executed, and `resolvedAt` would move every time somebody clicked.

`acknowledgedAt` is stamped on the first transition out of `OPEN` and never moved afterwards.

`actedById` is **`req.userId`** — see [Who acts on a request](planning.api.md#who-acts-on-a-request). It is a stand-in until auth lands, and becomes the authenticated user with no change here.

| Status | When |
| --- | --- |
| `200` | Transition applied |
| `404` | No such recommendation |
| `409` | The row is already resolved |

A missing row is `404`, not `500`. The routes these replace caught Prisma's `P2025` and returned a server error for what is the caller's mistake.

`byPriority` and `byStatus` are counted over the whole run, not over whatever page a caller happens to hold, so a summary panel beside a paginated list still totals the run.
