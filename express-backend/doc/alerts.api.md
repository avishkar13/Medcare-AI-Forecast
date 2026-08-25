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

One row per day, with a per-severity breakdown and a `total`.

**Every day in the window appears, including the quiet ones.** A chart that silently skips empty days draws a straight line through an outage.

---

## `GET /distribution`

Counts by `location`, `type` and `severity`, each ordered by count descending. Grouped in the database — the route this replaced loaded every alert into memory and reduced in JavaScript, which grows with the table for a result of a few rows.

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
