# Supply & DRP Plans API

Mounted at `/api` (`src/routes/plans_route.ts`). Two reads on the `read` tier, two decisions on `write`.

Shared conventions are in [`conventions.api.md`](conventions.api.md).

The plan artefacts a [planning run](planning.api.md) produced: **what to order** (`SupplyPlan`) and **what to move** (`DRPPlan`). Rows are written by the executor; nothing here creates them.

---

## Approving a plan does not move stock

`PATCH /supply-plans/:id/approve` records a decision. It writes `SupplyPlan.status` and nothing else — no `Inventory`, no `InventoryBatch`, no `DistributorOrder`.

The executor's hard boundary is that a plan is a *proposal*; that boundary does not move just because someone approved it. Executing an approved order against real stock is a separate system's job.

## Scope

Both reads default to the most recent `COMPLETED` run, and `meta.planningRunId` says which — so a page cannot show one run's orders under another run's heading. When no run has completed, both are empty rather than returning every plan ever written.

---

## `GET /api/supply-plans`

Soonest date first, then largest quantity — the orders that have to be placed next.

| Parameter | Type | Notes |
| --- | --- | --- |
| `runId` | string | Defaults to the latest `COMPLETED` run |
| `sku`, `warehouse` | string | cuid or code; unknown is `404` |
| `status` | `PROPOSED` \| `APPROVED` \| `REJECTED` | |
| `source` | `EXISTING` \| `TRANSFER` \| `PLANNED_SUPPLY` | |
| `page` / `pageSize` | integer | `1` / `50`, max `200` |

`source` says where the supply comes from: `EXISTING` is stock already in transit, `TRANSFER` is a DRP lane, `PLANNED_SUPPLY` is a new order released on the review cadence.

Product and warehouse labels are inline, so a list needs no second call per row.

## `PATCH /supply-plans/:id/approve` · `/reject`

`PROPOSED → APPROVED | REJECTED`.

**`PROPOSED` is the only actionable state.** A decided plan is not re-decided — without that guard an approval could be silently overwritten by a later reject, with nothing recording that it happened twice.

| Status | When |
| --- | --- |
| `200` | Decision recorded |
| `404` | No such plan |
| `409` | The plan is already `APPROVED` or `REJECTED` |

---

## `GET /api/drp-plans`

Proposed transfers between warehouses.

| Parameter | Notes |
| --- | --- |
| `runId` | Defaults to the latest `COMPLETED` run |
| `sku` | cuid or `sku` |
| `warehouse` | Matches transfers where this DC is **either** end |
| `page` / `pageSize` | `1` / `50`, max `200` |

```json
{
  "data": {
    "items": [
      { "id": "cmt9...", "sku": "SKU-AMX-500",
        "fromWarehouseCode": "DC-01", "fromWarehouseName": "Northeast DC",
        "toWarehouseCode": "DC-03", "toWarehouseName": "West DC",
        "date": "2026-09-02", "quantity": 420, "reason": "expiry-aware rebalance" }
    ],
    "totalUnits": 60798
  },
  "meta": { "generatedAt": "...", "page": 1, "pageSize": 50, "total": 172, "planningRunId": "cmt9..." }
}
```

**`warehouse` matches both ends.** Filtering only the source would hide half of what a DC is being asked to do — the inbound half.

**`totalUnits` covers the whole filtered set, not the page.** "How much is moving" should not require adding up every page.
