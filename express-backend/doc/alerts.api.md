# Alerts API

Mounted at `/api/alerts` (`src/routes/alerts_route.ts`). Five reads on the `read` tier, three state changes on `write`.

Shared conventions are in [`conventions.api.md`](conventions.api.md).

---

## Open values, not enums

`Alert.severity`, `type` and `status` are plain `String` columns in the schema — there is no database enum behind them. Filters are therefore **open strings**: a new severity added by a producer must not make the read route reject it.

Conventional values, defined in one place (`src/services/alert.service.ts`):

| Field | Values in use |
| --- | --- |
| `severity` | `critical`, `high`, `medium`, `low` |
| `status` | `new`, `acknowledged`, `in_progress`, `resolved` |

`status=open` is the one alias: it matches every not-yet-resolved state (`new`, `acknowledged`, `in_progress`).

---

## `GET /api/alerts`

Paginated, newest first.

| Parameter | Type | Notes |
| --- | --- | --- |
| `severity`, `type`, `location` | string | Exact match |
| `status` | string | Exact match, or `open` for the alias above |
| `page` / `pageSize` | integer | `1` / `50`, max `200` |

Rows are **shaped**, not passed straight through from Prisma: dates are ISO strings, and `ageDays` is computed. `metrics` and `timeline` come inline, timeline ordered oldest first.

---

## `GET /overview`

```json
{ "data": {
  "totalCount": 42, "criticalCount": 8, "highCount": 14,
  "unresolvedCount": 19, "resolvedCount": 23,
  "resolvedPercentage": 54.76,
  "todayCount": 5, "todayDelta": 2
} }
```

**`totalCount` is one `count()`, not a sum of the other fields.** The route this replaced computed `critical + high + unresolved + resolved`, which counts a critical unresolved alert twice — so the resolved percentage came out too low. The severity and status buckets genuinely overlap; only the total is a real total.

`resolvedPercentage` is `null` when there are no alerts, rather than `100`. Nothing resolved out of nothing is not full marks.

`todayDelta` compares today's count against yesterday's over the same window. It was hardcoded to `0`.

---

## `GET /trends`

| Parameter | Type | Default |
| --- | --- | --- |
| `days` | integer 1–365 | `30` |

`points` holds one row per day, with a per-severity breakdown and a `total`. `comparison` splits the window in half and reports the critical count on each side:

```json
{ "data": {
  "points": [ { "date": "2026-08-20", "total": 6, "critical": 1,
                "high": 2, "medium": 2, "low": 1 } ],
  "comparison": { "halfWindowDays": 7, "currentCritical": 9,
                  "previousCritical": 11, "criticalChangePercent": -18.18 }
} }
```

**Every day in the window appears, including the quiet ones.** A chart that silently skips empty days draws a straight line through an outage.

`criticalChangePercent` is `null` when the earlier half raised nothing — a rise from zero has no percentage. The comparison is served rather than left to the caller so a chart's footer states the same figure the chart draws.

---

## `GET /distribution`

Counts by `location`, `type` and `severity`, each ordered by count descending and each row carrying its `sharePercent` of `totalAlerts`. Grouped in the database — the route this replaced loaded every alert into memory and reduced in JavaScript, which grows with the table for a result of a few rows.

```json
{ "data": {
  "totalAlerts": 42,
  "byLocation": [ { "location": "DC-01", "count": 14, "sharePercent": 33.33 } ],
  "byType": [ { "type": "STOCKOUT_RISK", "count": 18, "sharePercent": 42.86 } ],
  "bySeverity": [ { "severity": "critical", "count": 6, "sharePercent": 14.29 } ]
} }
```

## `GET /health`

Health of the **alerting pipeline**, not of any hardware:

```json
{ "data": {
  "alertsTracked": 42, "openAlerts": 19,
  "lastDetectedAt": "2026-08-26T04:11:02.118Z",
  "oldestOpenAlertId": "cmt9...", "oldestOpenAgeDays": 12
} }
```

The route this replaced reported `99.9%` uptime and `1420` active sensors. There are no sensors in this system and nothing measures uptime — both were decoration. These are facts about the alert table that a reader can verify.

---

## Where alerts come from

`src/services/alert-detector.service.ts`, called by the planning executor once a run
reaches `COMPLETED`. Until it existed all eight routes here read a table nothing wrote,
so the review surface was permanently empty while `/api/dashboard/summary` reported
dozens of the same conditions.

Detection reads the **same positions the dashboard reads** (`loadPositions`), so the two
cannot disagree about the network.

| Type | Raised when | Threshold from settings |
| --- | --- | --- |
| `stockout_risk` | Days of supply leaves the lead time uncovered, and the position is below its reorder point | `thresholds.stockoutProbability` |
| `expiry_risk` | FEFO projection says demand will not consume a batch before it expires | `thresholds.expiryWindow` (days) |
| `overstock` | On hand above `maximumInventory` | — |
| `capacity_breach` | A warehouse's total units against its capacity | `thresholds.capacityUtilization` |
| `demand_spike` | The last 7 days against the preceding 28, where stock cannot absorb the new rate | `thresholds.demandDeviation` |

`types.*` in `/api/settings` gates each detector, and `realTimeMonitoring: false` stops
detection entirely — alerts already raised stay readable, they just stop being
reconciled.

**`supplier_delay` and `forecast_anomaly` are never raised.** `DistributorOrder` records
`requestedDate` but no actual delivery date, so there is no delay to measure, and no
anomaly signal is wired through from the forecasting engine. Both stay valid filter
values; they simply never match.

### Reconciliation, not truncation

Every detected condition carries a fingerprint of `type | sku | location`. Each run:

| Condition | Existing alert | Result |
| --- | --- | --- |
| Still true | Open, and unchanged | **Left untouched** — no metric churn, no `updatedAt` bump |
| Still true | Open, and something moved | Updated in place; `status` and `detectedAt` survive, so an acknowledgement is not undone and the age stays honest |
| Still true | None open | Created as `new`, with a `Condition detected` timeline entry |
| No longer true | Open | Resolved automatically, with a timeline entry saying so |

`resolved` rows are never matched, so a condition that returns raises a **fresh** alert
rather than silently reopening a closed one.

Writes are grouped by table into `createMany` batches and chunked. One
`alert.create` carrying its metrics and timeline costs eight statements, and this
network raises around ninety alerts — enough to overrun the transaction budget outright
against a hosted database. The phases are separate transactions on purpose:
reconciliation is idempotent, so a fault between them is corrected by the next run.

Detection failure is **swallowed by the executor**. The run's artefacts are already
committed and correct; letting a detector fault roll that back to `FAILED` would throw
away minutes of planning over a secondary read surface.

---

## State changes

| Route | Effect |
| --- | --- |
| `PATCH /:id/acknowledge` | `new` or `in_progress` → `acknowledged` |
| `PATCH /:id/resolve` | any open state → `resolved` |
| `POST /mark-all-read` | every `new` alert → `acknowledged`; returns `updatedCount` |

**`resolved` is terminal.** Acknowledging a resolved alert would reopen it by accident, so it is a `409`.

**Every transition appends a `AlertTimelineEvent`.** A status change that leaves no trace makes the timeline on the detail view a lie by omission.

| Status | When |
| --- | --- |
| `200` | Applied |
| `404` | No such alert |
| `409` | The alert is already resolved |
