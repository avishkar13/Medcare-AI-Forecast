# API Conventions

Everything that holds for every route, so the per-route files can stay about their own payloads. Written for the frontend client.

Base path is `/api` (`API_PREFIX`), so the backend running locally on port 4000 serves `http://localhost:4000/api/...`. Most routes are `GET`; the ones that change state use `POST`, `PATCH`, `PUT` and `DELETE` and are listed in their own files.

---

## Success envelope

```json
{
  "data": "<payload>",
  "meta": { "generatedAt": "2026-08-24T02:05:12.024Z" }
}
```

`data` is the payload — object or array, never a bare scalar. `meta.generatedAt` is the ISO 8601 instant the response was built, and is always present.

Paginated routes add three more fields:

```json
"meta": { "generatedAt": "…", "page": 1, "pageSize": 50, "total": 133 }
```

`total` is the count matching the filter, not the length of `data`. Divide by `pageSize` for the page count.

**Exceptions:** the two health probes return bare payloads with no envelope, and `/api/training-data` streams NDJSON — see [`training.api.md`](training.api.md).

---

## Error envelope

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed",
    "details": [{ "path": "page", "code": "too_small", "message": "Too small: expected number to be >=1" }],
    "requestId": "0b8a804f-f44a-4cec-9d4e-eb3bd6271c1d"
  }
}
```

`code` is the stable machine-readable string — branch on it, never on `message`. `message` is for humans and may be reworded. `requestId` is always present and matches the `x-request-id` response header, so a client-side error report can be traced to a server log line.

`details` appears only when the error carries more than a sentence, and its shape depends on the code:

| Code | `details` |
| --- | --- |
| `VALIDATION_FAILED` | **Array** of `{ path, code, message }`, one entry per rejected field. `path` is the parameter name. |
| `RATE_LIMIT_EXCEEDED` | **Object**: `{ "retryAfterSeconds": 16 }` |
| everything else | absent |

### Statuses a client can hit

| Status | `code` | When |
| --- | --- | --- |
| `404` | `NOT_FOUND` | Unknown id, SKU or warehouse — and any unrouted path, as `Cannot GET /api/nope` |
| `422` | `VALIDATION_FAILED` | Any query or path parameter the route's schema rejects |
| `429` | `RATE_LIMIT_EXCEEDED` | A tier's window is exhausted; see below |
| `500` | `INTERNAL_SERVER_ERROR` | Unhandled fault. In production the message is replaced with `Something went wrong`. |
| `503` | `DATABASE_UNAVAILABLE` | Postgres unreachable. Retry — the API is stateless and recovers on its own. |

Write routes will add `400 MALFORMED_JSON`, `409 CONFLICT` and `409 FOREIGN_KEY_VIOLATION`; no route emits them today.

---

## Headers

| Send | Effect |
| --- | --- |
| `x-request-id` | Echoed back and used as `error.requestId`, if it matches `[A-Za-z0-9_-]{8,64}`. Otherwise the server generates a UUID. Send your own to line a client log up with a server one. |
| `x-api-key` | **Not authentication.** It only replaces the client IP as the rate-limit identity, so two tabs behind one NAT can hold separate budgets. |

| Receive | On |
| --- | --- |
| `x-request-id` | Every response |
| `x-training-rows` | `/api/training-data` only — the row count the filter matched |
| `RateLimit`, `RateLimit-Policy` | Every rate-limited response, one pair per tier (IETF draft-8) |
| `Retry-After` | `429` only, in seconds |

All four are in `Access-Control-Expose-Headers`, so they are readable from the browser. CORS allows the origins in `CORS_ORIGINS` (`http://localhost:3000` by default) with credentials enabled.

---

## Rate limiting

Tiers count every request independently, keyed by `x-api-key` when present and by client IP otherwise. Every request passes through `global`; most also pass through `read`:

| Tier | Window | Limit | Applies to |
| --- | --- | --- | --- |
| `global` | 60s | 300 | Every request except `/api/health/*` |
| `read` | 60s | 120 | Every `GET` route except `/api/health/live` and `/api/training-data` |
| `expensive` | 60min | 10 | `/api/training-data` only |

Both figures are the defaults and are configurable per environment. A response carries one `RateLimit` line per tier:

```
RateLimit: "global"; r=288; t=5
RateLimit: "read"; r=108; t=5
```

`r` is requests remaining, `t` is seconds until the window resets. Exhausting either tier returns `429` with `Retry-After` and the seconds repeated in `error.details.retryAfterSeconds` — wait that long rather than retrying immediately.

---

## Types and parsing

- **Money and quantities** are JSON numbers. `unitCost` is `Decimal(12,2)` in Postgres and is serialized as a number, not a string.
- **Dates** are ISO 8601 strings in UTC (`2026-08-29T00:00:00.000Z`). `/api/training-data` is the exception: its grain is a calendar day, so it sends `2026-08-29`.
- **Missing values** are `null`, never omitted and never a placeholder `0`. A field documented as `number | null` is `null` because the input for it does not exist yet.
- **Empty results** are `[]` with a `200`, not a `404`. A `page` past the end behaves the same way, with the true `meta.total`.
- **Unknown query parameters** are ignored, not rejected.
- **Booleans in query strings** are case-insensitive: `true`/`1`/`yes`/`on`/`y`/`enabled` and their negatives.

---

## Authentication

There is none. Every route is open. `User` and `UserRole` exist in the database and the seed creates one `SYSTEM` user so planning records have a valid author, but no route reads or enforces identity.
