# MedCare AI Forecast — Project-Fit ML Engine

This is the **ML-only demand forecasting service** for the MedCare-AI-Forecast project.

## What it does

- Reads historical demand from the project's PostgreSQL `DemandHistory` table.
- Uses SKU and warehouse from the project's `Product.sku` and `Warehouse.code`.
- Builds leakage-safe lag, rolling, trend, calendar and promotion/seasonality features.
- Compares against a 7-day moving-average baseline.
- Trains XGBoost point and quantile models.
- Uses chronological holdout and rolling time-series validation.
- Reports MAE, RMSE, wMAPE and probabilistic metrics.
- Produces P10/P50/P90 forecasts.
- Applies conformal calibration to the prediction interval.
- Detects demand anomalies and provides a confidence/risk signal.
- Exposes a FastAPI service for the main backend.

## What it does NOT do

- No replenishment quantity decision.
- No purchase-order creation.
- No supplier selection.
- No transfer optimization.
- No safety-stock decision.
- No inventory-plan writes.
- No planning-table writes.

## Project integration

See **API_INTEGRATION.md** for the exact API contract and the mapping to the Prisma `Forecast` model.

## Quick start

```powershell
python -m venv .venv
& ".\.venv\Scripts\python.exe" -m pip install -r requirements.txt
```

Create `.env` from `.env.example` and set the same `DATABASE_URL` used by the Express backend.

Train on the real project data:

```powershell
& ".\.venv\Scripts\python.exe" -m src.train_project
```

Run the service:

```powershell
& ".\.venv\Scripts\python.exe" -m uvicorn src.api:app --host 0.0.0.0 --port 8001
```

Open:

`http://localhost:8001/docs`

## API examples

```text
GET /health
GET /forecast/SKU-AMX-500/DC-01?horizon=7
POST /forecast
GET /model/metrics
```

## Model boundary

```text
PostgreSQL DemandHistory
        |
        v
Feature Engineering
        |
        v
XGBoost + Quantile XGBoost
        |
        v
P10 / P50 / P90
        |
        v
Uncertainty + Anomaly + Confidence
        |
        v
FastAPI
        |
        v
Main Express Backend
```
