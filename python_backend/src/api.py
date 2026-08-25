from __future__ import annotations

from dotenv import load_dotenv
load_dotenv()

import json
import os
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

from src.anomaly import detect_demand_anomaly
from src.data_project import load_history, load_product_metadata
from src.models.model import load_bundle
from src.forecasting.forecast import model_drivers
from src.preprocessing.features import clean_data, add_features, feature_columns
from src.project_adapter import canonicalize_project_history
from src.project_signals import build_future_signals

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "artifacts"
OUT = ROOT / "outputs"
BUNDLE_PATH = ART / "forecast_pipeline.joblib"
META_PATH = ART / "model_metadata.json"

app = FastAPI(title="MedCare Demand Forecast ML Service", version="1.0.0")


class ForecastRequest(BaseModel):
    sku_id: str = Field(min_length=1)
    warehouse_id: str = Field(min_length=1)
    horizon_days: int = Field(default=7, ge=1, le=30)


def _meta():
    if not META_PATH.exists():
        return {}
    return json.loads(META_PATH.read_text())


def _project_forecast(sku: str, dc: str, horizon: int):
    if not BUNDLE_PATH.exists():
        raise RuntimeError("Model artifact missing. Run: python -m src.train_project")
    raw = load_history(sku, dc)
    if raw.empty:
        raise ValueError(f"No DemandHistory found for SKU={sku}, warehouse={dc}")
    clean = canonicalize_project_history(raw)
    if len(clean) < 35:
        raise ValueError(f"At least 35 historical daily rows are required; found {len(clean)}")

    bundle = load_bundle(BUNDLE_PATH)
    meta = _meta()
    w = clean.sort_values("date").reset_index(drop=True)
    dates = [w.date.max() + pd.Timedelta(days=i) for i in range(1, horizon + 1)]
    signals = build_future_signals(w, sku, dc, dates)
    cols = feature_columns()
    daily = []

    for i, nd in enumerate(dates):
        row = pd.DataFrame([{
            "date": nd,
            "sku_id": sku,
            "dc_id": dc,
            "demand": np.nan,
            "promotion_flag": int(signals.promotion_flag.iloc[i]),
            "seasonality_index": float(signals.seasonality_index.iloc[i]),
        }])
        f = add_features(pd.concat([w, row], ignore_index=True), training=False).tail(1)
        p10 = max(0.0, float(bundle["q10"].predict(f[cols])[0]) - float(meta.get("conformal_delta", 0)))
        p50 = max(0.0, float(bundle["q50"].predict(f[cols])[0]))
        p90 = max(p50, float(bundle["q90"].predict(f[cols])[0]) + float(meta.get("conformal_delta", 0)))
        daily.append({
            "forecastDate": str(pd.Timestamp(nd).date()),
            "p10": round(p10, 2),
            "p50": round(p50, 2),
            "p90": round(p90, 2),
            "promotionFlag": int(signals.promotion_flag.iloc[i]),
            "seasonalityIndex": round(float(signals.seasonality_index.iloc[i]), 3),
        })
        w = pd.concat([w, row.assign(demand=p50)], ignore_index=True)

    vals = np.array([x["p50"] for x in daily])
    lo = np.array([x["p10"] for x in daily])
    hi = np.array([x["p90"] for x in daily])
    point, lower, upper = float(vals.mean()), float(lo.mean()), float(hi.mean())
    recent = float(clean.tail(7).demand.mean())
    growth = (point - recent) / max(recent, 1e-8)
    interval_width = (upper - lower) / max(point, 1e-8)
    anomaly = detect_demand_anomaly(clean)
    anomaly_risk = {"NORMAL": 0, "MEDIUM": .35, "HIGH": .7, "CRITICAL": 1}[anomaly["level"]]
    risk = min(1.0, .55 * min(max(growth, 0) / .60, 1) + .30 * min(interval_width / .60, 1) + .15 * anomaly_risk)
    risk_level = "CRITICAL" if risk >= .75 else "HIGH" if risk >= .50 else "MEDIUM" if risk >= .25 else "LOW"
    coverage = float(meta.get("p10_p90_coverage_percent", 0)) / 100
    confidence = max(.50, min(.99, .60 * coverage + .40 * (1 - min(interval_width / .80, 1))))

    drivers = model_drivers(bundle, cols)
    md = load_product_metadata(sku, dc)
    return {
        "sku_id": sku,
        "warehouse_id": dc,
        "product_id": md["product_id"],
        "warehouse_db_id": md["warehouse_id"],
        "model": meta.get("production_model", "XGBoost + Quantile XGBoost"),
        "model_version": meta.get("model_version", "unknown"),
        "forecast": round(point, 2),
        "lower_bound": round(lower, 2),
        "upper_bound": round(upper, 2),
        "confidence": round(confidence, 3),
        "confidence_interval": "P10-P90",
        "forecast_risk_score": round(risk, 3),
        "forecast_risk_level": risk_level,
        "forecast_horizon_days": horizon,
        "recent_7d_actual_mean": round(recent, 2),
        "demand_growth_percent": round(growth * 100, 2),
        "demand_anomaly": anomaly,
        "global_model_drivers": drivers,
        "daily_forecasts": daily,
        "handoff": {
            "forecast_is_ml_output": True,
            "output_is_ready_for_downstream_system": True,
            "ml_does_not_decide_replenishment_quantity": True,
            "ml_does_not_write_inventory_or_planning_tables": True,
        },
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "medcare-ml-forecast",
        "data_source": os.getenv("ML_DATA_SOURCE", "project"),
        "model_ready": BUNDLE_PATH.exists(),
    }


@app.get("/forecast/{sku_id}/{warehouse_id}")
def forecast_get(
    sku_id: str,
    warehouse_id: str,
    horizon: int = Query(7, ge=1, le=30),
):
    try:
        if os.getenv("ML_DATA_SOURCE", "project").lower() != "project":
            raise ValueError("This project-compatible package is configured for ML_DATA_SOURCE=project")
        return _project_forecast(sku_id, warehouse_id, horizon)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/forecast")
def forecast_post(req: ForecastRequest):
    try:
        return _project_forecast(req.sku_id, req.warehouse_id, req.horizon_days)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/model/metrics")
def model_metrics():
    p = OUT / "model_metrics.json"
    if not p.exists():
        raise HTTPException(status_code=404, detail="Metrics unavailable. Train the project model first.")
    return json.loads(p.read_text())
