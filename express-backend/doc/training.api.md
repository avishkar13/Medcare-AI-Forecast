# Training Data API

Mounted at `/api/training-data` (`src/routes/training_route.ts`). One `GET`, open, rate limited on the **`expensive`** tier.

This is the only route in the API not written for the frontend. Its consumer is the Python forecasting service, which uses it for both model training and per-run inference — the same endpoint for both, so the features a model is fitted on are the features it later predicts against. It exports the demand series behind every forecast: one row per product, per warehouse, per day.

**It deviates from [`conventions.api.md`](conventions.api.md) in four ways.** Read this before the rest:

| Convention | Here | Why |
| --- | --- | --- |
| `{ data, meta }` envelope | **NDJSON** — one JSON object per line | An envelope must be fully built in memory before it can be sent. The point of this route is to stream. |
| Dates are ISO instants (`2026-08-29T00:00:00.000Z`) | Calendar days (`2026-08-29`) | The grain is a day. A timestamp invites a timezone bug in `groupby`. |
| `read` tier (120/min) | `expensive` tier (10/hour) | A full export is seconds of database work, not a page render. |
| Empty result is `200` with `[]` | Unknown `sku` or `warehouse` is `404` | A silently empty training set is a model that trains on nothing and reports success. |

---

## `GET /api/training-data`

### Request

Every parameter is optional. With none, you get the full history.

| Parameter | Type | Notes |
| --- | --- | --- |
| `from` | `YYYY-MM-DD` | Earliest date, **inclusive**. Stored dates are at midnight, so the named day is included. |
| `to` | `YYYY-MM-DD` | Latest date, **inclusive**. Must not be earlier than `from`. |
| `sku` | string | One product. Accepts the **cuid** or the **`sku`** (`SKU-AMX-500`). Unknown value is `404`. |
| `warehouse` | string | One DC. Accepts the **cuid** or the **`code`** (`DC-01`). Unknown value is `404`. |

```
/api/training-data
/api/training-data?from=2026-01-01&to=2026-06-30
/api/training-data?sku=SKU-AMX-500&warehouse=DC-01
```

### Response `200`

```
Content-Type:    application/x-ndjson; charset=utf-8
Cache-Control:   no-store
x-training-rows: 28800
```

```
{"date":"2026-02-25","sku":"SKU-AMX-500","productId":"cmt6kuign000574jdlxf1lsg8","dc":"DC-01","warehouseId":"cmt6kui8o000174jduxbwkuug","demand":106,"fulfilled":106,"stockout":false,"promotion":false,"holiday":false,"season":"flu"}
{"date":"2026-02-26","sku":"SKU-AMX-500","productId":"cmt6kuign000574jdlxf1lsg8","dc":"DC-01","warehouseId":"cmt6kui8o000174jduxbwkuug","demand":115,"fulfilled":115,"stockout":false,"promotion":false,"holiday":false,"season":"flu"}
```

| Field | Type | Source | Notes |
| --- | --- | --- | --- |
| `date` | `YYYY-MM-DD` | `DemandHistory.date` | |
| `sku` | string | `Product.sku` | Readable key — for notebooks and plots |
| `productId` | string | `DemandHistory.productId` | cuid — the key sent back when writing forecasts |
| `dc` | string | `Warehouse.code` | Readable key |
| `warehouseId` | string | `DemandHistory.warehouseId` | cuid |
| `demand` | number | `orderedQuantity` | **The target.** Demand as ordered, before any supply constraint. |
| `fulfilled` | number \| null | `fulfilledQuantity` | What actually shipped. `null` where unrecorded. |
| `stockout` | boolean | `stockoutFlag` | The day was supply-constrained |
| `promotion` | boolean | `promotionFlag` | A promotion was active |
| `holiday` | boolean | `holidayFlag` | |
| `season` | string \| null | `season` | A label, not an index. `"flu"` / `"regular"` in seeded data. |
| `region` | string \| null | `Warehouse.region` | The key `DemandSignal` rows are grouped by. Without it a consumer cannot line the forward-dated signals up with the warehouses they apply to. |
| `promotionUplift` | number \| null | `PromotionEvent.upliftFactor` | From a promotion overlapping this row's date, scoped to this product/warehouse. `null` when none |
| `promotionType` | string \| null | `PromotionEvent.type` | |
| `demandSignalType` | string \| null | `DemandSignal.signalType` | `flu_incidence_per_100k` in seeded data |
| `demandSignalValue` | number \| null | `DemandSignal.value` | The signal for **this warehouse's region** on this date |

Both key forms travel on every row on purpose: read `sku` and `dc`, write back `productId` and `warehouseId`. It costs ~50 bytes a row and removes a join from the consumer.

**`demand` is `orderedQuantity`, not `fulfilledQuantity`.** Fitting against what shipped teaches the model that a stockout was low demand. `orderedQuantity` is the uncensored signal; `stockout` and `fulfilled` are there so the model can tell a quiet day from a day you could not supply.

### Trailer segments

After the history rows, the stream carries two more segments. Both tag themselves with `_type`; history rows have no `_type`, so a reader groups history by filtering them out.

```
{"_type":"future_signal","region":"West","date":"2026-08-24","signalType":"flu_incidence_per_100k","value":37.45}
{"_type":"future_promotion","productId":"cmt6...","warehouseId":null,"startDate":"2026-08-31","endDate":"2026-09-21","type":"CAMPAIGN","upliftFactor":1.2,"name":"Antibiotic Stewardship Push"}
```

| Segment | Header | Contains |
| --- | --- | --- |
| history | `x-training-rows` | One row per product per warehouse per day |
| `future_signal` | `x-future-signals` | Signals dated **after the last day of history** |
| `future_promotion` | `x-future-promotions` | Promotions **still running or starting later** — `endDate >= today` |

**Why these exist.** A forecast horizon is in the future, and both of these describe it. Flu incidence is published ahead of the demand it drives, so without the forward-dated signals the model trains on a leading indicator and then predicts with nothing in that column. Same for promotions: a scheduled campaign is knowable in advance, and a horizon without it forecasts a normal week.

**`future_promotion` is not `startDate > now`.** A promotion that began last week and runs another month is the most relevant one there is, and it cannot ride on a history row either, because history stops before today.

**Each segment is counted separately.** Compare each against its own header. Comparing every parsed line against `x-training-rows` fails the moment a trailer exists; comparing against one grand total lets a truncation inside history hide behind a trailer that never arrived.

### Ordering

`productId` ascending, then `warehouseId` ascending, then `date` ascending.

Two guarantees follow, both covered by tests:

- **Each series is contiguous.** All rows for one product-warehouse pair arrive together, so a consumer can group without buffering the whole set.
- **Dates ascend within a series.** No re-sort before differencing or windowing.

`@@unique([productId, warehouseId, date])` means there is never a duplicate day for a series.

### Truncation

`x-training-rows` is the number of rows the filter matched, sent before the body. **Compare it to what you parsed.**

A stream cut short — request timeout, dropped connection — is still syntactically valid NDJSON, so a consumer that does not check will train on partial data and report success. This header is the only way to detect that.

### Errors

Errors use the standard envelope from [`conventions.api.md`](conventions.api.md), so a client must branch on status before choosing a parser: a `200` body is NDJSON, an error body is JSON.

| Status | `code` | When |
| --- | --- | --- |
| `404` | `NOT_FOUND` | `sku` or `warehouse` matches no record |
| `422` | `VALIDATION_FAILED` | `from` later than `to`, or a date that will not parse |
| `429` | `RATE_LIMIT_EXCEEDED` | Over 10 requests in the rolling hour; `Retry-After` gives the wait |

An error raised **before** the first row is a clean JSON response. The count query runs first precisely so the common failures land there.

### Scale

Measured against the seeded set — 40 products, 4 warehouses, 180 days:

| | |
| --- | --- |
| Rows | 28,800 |
| Wire size | 6.4 MB (~222 bytes/row, gzipped in transit) |
| Time | ~2s end to end |
| Throughput | ~14,800 rows/s |
| Server heap | ~7 MB, **flat regardless of row count** |

Rows are read in cursor-paged batches of 10,000 and written straight to the socket, so server memory does not grow with the dataset. Backpressure is honoured — a slow reader slows the database reads rather than filling a buffer.

**The ceiling is `SERVER.requestTimeoutMs` (30s), not memory** — roughly 440,000 rows per request. Past that, use `from`/`to` to pull in windows and concatenate. Chunking is also what makes a failed export resumable.

### Consuming it

```python
import pandas as pd, requests

DTYPES = {"sku": "category", "productId": "category",
          "dc": "category", "warehouseId": "category", "season": "category"}

r = requests.get("http://localhost:4000/api/training-data",
                 params={"from": "2026-01-01", "to": "2026-06-30"}, stream=True)
r.raise_for_status()

df = pd.read_json(r.raw, lines=True)
assert len(df) == int(r.headers["x-training-rows"]), "truncated stream"
df = df.astype(DTYPES)
```

The categorical dtypes matter at scale: the five string columns are low-cardinality, and leaving them as `object` costs roughly ten times the memory of the payload itself.

### Deliberately absent

Three fields a forecasting feature set might be expected to carry are not here, each for a reason:

| Field | Why not |
| --- | --- |
| `inventory_level` | **No historical source exists.** `Inventory` holds a current balance — one row per product-warehouse, no date. Nothing in the schema snapshots it daily. Its value to a demand model is detecting censored days, and `stockout` plus `fulfilled` carry that signal directly and more precisely. |
| `seasonality_index` | **Derived, not stored.** Computing it here would put the same formula in two languages and risk train/serve skew, since inference would have to reproduce it identically. The raw inputs — `date`, `season`, `holiday`, `promotion` — are exported instead; the index belongs in the consumer. |
| `lead_time_days` | **Not a time series, and not demand.** `PlanningParameter` is keyed by product-warehouse with no date, so it would repeat one value across every row. It is a supply parameter, used downstream in safety stock and reorder point — see [`inventory.api.md`](inventory.api.md). |

No route fabricates a value it does not have, and these are the three places that rule bites hardest.
