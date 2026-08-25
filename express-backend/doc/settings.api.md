# Settings API

Mounted at `/api/settings` (`src/routes/settings_route.ts`). One read, two writes.

Shared conventions are in [`conventions.api.md`](conventions.api.md).

---

## Shape

One configuration tree, stored across eight related tables (`GeneralSettings`, `ForecastSettings`, `InventorySettings`, `AlertSettings`, `NotificationSettings`, `AISettings`, `IntegrationSettings`, `SecuritySettings`) and served as a single nested JSON object.

The mapping between the two lives in `src/services/settings.service.ts` (`mapPrismaToFrontend` / `mapFrontendToPrismaCreate`). That file owns the shape — it is not duplicated in a zod schema, because two copies of a shape this size are a guarantee they will drift.

There is exactly **one settings row**. The first `GET` seeds it from the defaults.

---

## `GET /api/settings`

Returns the whole tree in the standard envelope. Seeds defaults on first use.

## `PATCH /api/settings`

Deep-merges the body into the current settings and returns the result.

```http
PATCH /api/settings
{ "general": { "theme": "dark" } }
```

**Only `theme` changes.** Every other field in `general`, and every other block, is untouched.

That is worth stating plainly because it was not true: the merge was `{ ...current, ...patch }`, a shallow spread, so patching one field **replaced the entire block it lived in** and silently dropped its siblings. The documentation claimed a deep merge; the code did not do one.

| Value type | Merge behaviour |
| --- | --- |
| Object | Merged recursively |
| Array | **Replaced whole** — a notification rule list is one value, and merging two lists by index means nothing |
| `undefined` | Ignored, so a key can be omitted without clearing it |
| Anything else | Replaced |

## `PUT /api/settings`

Resets to defaults, then applies the body — a true replace rather than a `PATCH` wearing a different verb.

---

## How a write is applied

The whole tree is rewritten on every write: delete the row, create it again from the merged value. A partial update across eight related tables would need eight upserts plus child reconciliation, for a configuration object that is written rarely.

**The delete and the create run in one transaction.** They used to be two separate `await`s, so a failure between them left the system with **no settings at all and no way back**. There is a test asserting exactly one row survives a write.

## Validation

The body must be a JSON **object**. An array is `422`; a bare string or number is `400 MALFORMED_JSON`, refused by Express's strict JSON parser before it reaches the schema.

Leaf values are not individually validated — see *Shape* above for why. A patch that names a key the mapper does not know is merged into the stored tree and dropped on the next write, rather than rejected.

| Status | When |
| --- | --- |
| `200` | Read or write applied |
| `400` | Body is not JSON, or is a bare scalar |
| `422` | Body is an array |

---

## Not implemented

Two routes existed and were removed rather than rewritten, because both reported success while doing nothing:

| Route | What it returned | Why it is gone |
| --- | --- | --- |
| `POST /integrations/test` | `{"success": true, "message": "Connection successful", "latencyMs": 145}` | It contacted nothing. A connection test needs a configured ERP endpoint to actually reach |
| `POST /security/reset-password` | `{"success": true, "message": "Password reset email sent."}` | It sent nothing. This needs an authenticated user (WP-16) and mail delivery |

The password one mattered most: a reset route that reports success while sending no mail is worse than a missing one, because the user waits for an email that was never going to arrive.
