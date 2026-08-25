# MedCare ML Forecast Service — Backend Integration

## Responsibility boundary

This service is **ML-only**. It produces demand forecasts and uncertainty signals. It does not calculate replenishment quantities, purchase orders, transfers, safety-stock decisions, or inventory plans, and it does not write planning tables.

## Project data source

The service reads the existing MedCare PostgreSQL database using the Prisma schema:

- `Product.sku`
- `Warehouse.code`
- `DemandHistory.date`
- `DemandHistory.orderedQuantity`
- `DemandHistory.promotionFlag`
- `DemandHistory.holidayFlag`
- `PromotionEvent`

The ML target is `DemandHistory.orderedQuantity`.

## Start

From this folder:

```powershell
python -m venv .venv
& ".\.venv\Scripts\python.exe" -m pip install -r requirements.txt
```

Set `DATABASE_URL` in `.env` to the same PostgreSQL database used by the Express backend.

Train from the real MedCare database:

```powershell
& ".\.venv\Scripts\python.exe" -m src.train_project
```

Start the API:

```powershell
& ".\.venv\Scripts\python.exe" -m uvicorn src.api:app --host 0.0.0.0 --port 8001
```

Swagger:

`http://localhost:8001/docs`

## Endpoints

### Health

```http
GET /health
```

### Forecast — GET

```http
GET /forecast/{sku_id}/{warehouse_id}?horizon=7
```

Example:

```http
GET /forecast/SKU-AMX-500/DC-01?horizon=7
```

The identifiers can be the project SKU/warehouse codes or their database IDs.

### Forecast — POST

```http
POST /forecast
Content-Type: application/json
```

```json
{
  "sku_id": "SKU-AMX-500",
  "warehouse_id": "DC-01",
  "horizon_days": 7
}
```

### Metrics

```http
GET /model/metrics
```

## Forecast response

The important fields for the Express backend are:

```json
{
  "sku_id": "SKU-AMX-500",
  "warehouse_id": "DC-01",
  "product_id": "...",
  "warehouse_db_id": "...",
  "model": "XGBoost + Quantile XGBoost",
  "model_version": "medcare-xgb-qrf-v1",
  "forecast": 120.5,
  "lower_bound": 96.2,
  "upper_bound": 151.7,
  "confidence": 0.91,
  "daily_forecasts": [
    {
      "forecastDate": "2026-09-01",
      "p10": 96.2,
      "p50": 120.5,
      "p90": 151.7,
      "promotionFlag": 0,
      "seasonalityIndex": 1.08
    }
  ]
}
```

The `daily_forecasts` fields map directly to the project's `Forecast` model:

| ML output | Prisma `Forecast` field |
|---|---|
| `product_id` | `productId` |
| `warehouse_db_id` | `warehouseId` |
| `forecastDate` | `forecastDate` |
| `p10` | `p10` |
| `p50` | `p50` |
| `p90` | `p90` |
| `model_version` | `modelVersion` |

`planningRunId` is created by the main backend/planning workflow, not by the ML service.

## Integration flow

```text
Express Backend
      |
      | SKU + Warehouse + Horizon
      v
MedCare ML FastAPI :8001
      |
      +--> DemandHistory / PromotionEvent (read-only)
      |
      +--> Feature Engineering
      +--> XGBoost
      +--> Quantile XGBoost
      +--> Conformal Calibration
      +--> Anomaly / Confidence
      |
      v
P10 / P50 / P90 + signals
      |
      v
Express Backend
      |
      +--> creates PlanningRun
      +--> persists Forecast rows
      +--> downstream inventory/planning logic
```

## Important

The ML service **does not insert/update** `Forecast`, `InventoryPlan`, `SupplyPlan`, `DRPPlan`, or `Recommendation` records. This keeps the ML boundary clean and avoids duplicating the planning team's responsibility.
