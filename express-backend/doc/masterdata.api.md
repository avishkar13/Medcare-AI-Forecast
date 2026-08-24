# Master Data API

Mounted at `/api` (`src/routes/masterdata_route.ts`). All routes are `GET`, open, and rate limited on the `read` tier.

Reference data the dashboard needs for selectors, filters and labels. Read-only for now — no create, update or delete.

---

## `GET /api/products`

Paginated product catalogue.

### Request

| Parameter | Type | Default | Notes |
| --- | --- | --- | --- |
| `search` | string | — | Case-insensitive substring, matched against **either** `sku` or `name` |
| `category` | string | — | Exact match |
| `criticality` | `LOW` \| `MEDIUM` \| `HIGH` \| `CRITICAL` | — | Exact match; any other value is `422` |
| `isActive` | boolean | — | Accepts `true`/`false`/`1`/`0`/`yes`/`no` |
| `page` | integer ≥ 1 | `1` | `0` or negative is `422` |
| `pageSize` | integer 1–200 | `50` | Above 200 is `422` |

Results are ordered by `sku` ascending.

### Response `200`

```json
{
  "data": [
    {
      "id": "cmt6kuign000774jdjppd31q6",
      "sku": "SKU-LIS-10",
      "name": "Lisinopril 10mg Tablets",
      "category": "Cardiovascular",
      "unit": "unit",
      "unitCost": 0.22,
      "shelfLifeDays": 730,
      "criticality": "CRITICAL",
      "isActive": true
    }
  ],
  "meta": {
    "generatedAt": "2026-08-24T02:05:12.024Z",
    "page": 1,
    "pageSize": 50,
    "total": 1
  }
}
```

`meta.total` is the count matching the filter, not the page length — divide by `pageSize` for page count.

### Fields

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | cuid. Use this for anything that later mutates the record. |
| `sku` | string | Human identifier, unique. Stable across environments, unlike the cuid. |
| `category` | string \| null | Free text, nullable |
| `unitCost` | number | `Decimal(12,2)` in Postgres, serialized as a JSON number |
| `shelfLifeDays` | number \| null | Nullable |

### Errors

`422 VALIDATION_FAILED` on any invalid parameter, with the offending field in `error.details[].path`.

---

## `GET /api/products/:id`

A single product.

### Request

| Parameter | Type | Notes |
| --- | --- | --- |
| `id` | string | Accepts **either** the cuid or the SKU — `/api/products/SKU-LIS-10` and `/api/products/cmt6kuign000774jdjppd31q6` both resolve |

### Response `200`

```json
{
  "data": {
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
  "meta": { "generatedAt": "2026-08-24T02:05:12.024Z" }
}
```

Same field shape as one element of the list response.

### Errors

```json
{ "error": { "code": "NOT_FOUND", "message": "Product 'NOPE' not found", "requestId": "b5f4196f-…" } }
```

`404` when neither the cuid nor the SKU matches.

---

## `GET /api/warehouses`

All distribution centres. Not paginated — the network is four DCs and will not grow to a size that needs it.

### Request

| Parameter | Type | Notes |
| --- | --- | --- |
| `tier` | `METRO` \| `TIER_1` \| `TIER_2` \| `TIER_3` | Exact match; any other value is `422` |
| `region` | string | Exact match |
| `isActive` | boolean | Accepts `true`/`false`/`1`/`0`/`yes`/`no` |

Results are ordered by `code` ascending.

### Response `200`

```json
{
  "data": [
    {
      "id": "cmt6k7m660001d8jd3v0l6n2y",
      "code": "DC-01",
      "name": "Northeast DC",
      "region": "Northeast",
      "tier": "METRO",
      "location": "Boston, MA",
      "capacity": 500000,
      "isActive": true
    }
  ],
  "meta": { "generatedAt": "2026-08-24T02:05:12.024Z" }
}
```

### Fields

| Field | Type | Notes |
| --- | --- | --- |
| `tier` | enum | `METRO` and `TIER_2` carry the brief's core contrast — metro excess vs Tier-2 stockouts |
| `capacity` | number \| null | Units. Denominator for the utilization figure in `/dashboard/network` |

### Current seed data

| Code | Name | Region | Tier | Capacity |
| --- | --- | --- | --- | --- |
| DC-01 | Northeast DC | Northeast | METRO | 500,000 |
| DC-02 | South DC | South | TIER_1 | 350,000 |
| DC-03 | West Coast DC | West | METRO | 600,000 |
| DC-04 | Midwest DC | Midwest | TIER_2 | 250,000 |
