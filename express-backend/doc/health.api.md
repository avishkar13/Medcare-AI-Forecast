# Health API

Mounted at `/api/health` (`src/routes/health_route.ts`).

Health responses are **not** wrapped in the standard `{ data, meta }` envelope — a probe answers with the smallest body that carries the verdict.

Shared conventions — response envelope, error codes, headers and rate limits — are in [`conventions.api.md`](conventions.api.md) and not repeated here.

---

## `GET /api/health/live`

Process liveness. Answers only "is this Node process running and able to respond". Touches no dependency.

**Request** — no parameters. Not rate limited.

**Response `200`**

```json
{ "status": "ok" }
```

This route cannot return anything else. If the process is unhealthy the request fails at the transport level.

---

## `GET /api/health/ready`

Readiness. Answers "can this instance serve traffic", which requires its dependencies.

**Request** — no parameters. Rate limited on the `read` tier.

**Response `200`** — all dependencies reachable

```json
{
  "status": "ok",
  "uptimeSeconds": 964,
  "dependencies": { "database": "up", "redis": "up", "forecast": "not_configured" }
}
```

**Response `503`** — at least one dependency down

```json
{
  "status": "degraded",
  "uptimeSeconds": 12,
  "dependencies": { "database": "down", "redis": "up", "forecast": "up" }
}
```

### Fields

| Field | Type | Notes |
| --- | --- | --- |
| `status` | `"ok" \| "degraded"` | `degraded` when a dependency the instance cannot work without is `down` — see below |
| `uptimeSeconds` | `number` | Whole seconds since process start |
| `dependencies.database` | `"up" \| "down"` | `SELECT 1` against Postgres |
| `dependencies.redis` | `"up" \| "down" \| "not_configured"` | `not_configured` when `REDIS_URL` is unset |
| `dependencies.forecast` | `"up" \| "down" \| "not_configured"` | The Python forecasting service. `not_configured` when `FORECAST_SERVICE_URL` is unset |

`not_configured` does **not** make the report degraded — running without Redis is a supported development mode, and rate limiting falls back to per-process memory.

The same applies to the forecast engine, and one step further: while `FORECAST_FALLBACK` is on, a `forecast` of **`down`** does not degrade the report either. The instance still answers every route and still produces plans from the naive forecast, so taking it out of rotation would restart a container that is working. Only with the fallback disabled does a dead engine mean the instance cannot do its job.
