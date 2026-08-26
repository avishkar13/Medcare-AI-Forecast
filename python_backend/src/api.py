"""MedCare demand forecasting engine.

Implements doc/forecast.contract.md from the Express backend: a batch POST /forecast
keyed on the cuids the planner uses, dense parallel arrays out, and no database.
"""
from __future__ import annotations

import json
from datetime import date, datetime, timezone
from typing import Optional

import pandas as pd
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from src.config import (
    ARTIFACTS_DIR,
    BUNDLE_PATH,
    MAX_HORIZON_DAYS,
    METADATA_PATH,
    METRICS_PATH,
    MODEL_VERSION,
    OUTPUTS_DIR,
)
from src.forecasting.recursive import forecast_series
from src.models.model import load_bundle
from src.project_adapter import canonicalize_training_data, pair_index
from src.training_client import (
    TrainingDataUnavailable,
    cache_state,
    fetch_training_data,
    future_signals,
    reachable,
)
from src.training_core import train_dataframe

app = FastAPI(title="MedCare Demand Forecast Engine", version="2.0.0")


class EngineError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


@app.exception_handler(EngineError)
def engine_error_handler(_request: Request, error: EngineError) -> JSONResponse:
    return JSONResponse(
        status_code=error.status,
        content={"error": {"code": error.code, "message": error.message}},
    )


@app.exception_handler(RequestValidationError)
def validation_error_handler(_request: Request, error: RequestValidationError) -> JSONResponse:
    """Answers a malformed request in the contract's envelope rather than FastAPI's.

    The contract pins every non-2xx body to {"error": {"code", "message"}}, and 422 to
    "the request did not validate". FastAPI's default handler bypasses
    `engine_error_handler` entirely and answers {"detail": [...]}, so the one status the
    contract names explicitly was the one status that did not honour it.
    """
    message = "; ".join(
        f"{'.'.join(str(part) for part in issue['loc'][1:]) or 'body'}: {issue['msg']}"
        for issue in error.errors()[:3]
    )

    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "REQUEST_INVALID",
                "message": message or "the request did not validate",
            }
        },
    )


class Pair(BaseModel):
    productId: str = Field(min_length=1)
    warehouseId: str = Field(min_length=1)


class ForecastRequest(BaseModel):
    runId: str = Field(min_length=1)
    horizonDays: int = Field(ge=1, le=365)
    asOf: date
    pairs: list[Pair] = Field(min_length=1)


class TrainRequest(BaseModel):
    modelVersion: str = Field(default=MODEL_VERSION, min_length=1, max_length=100)


def _metadata() -> dict:
    if not METADATA_PATH.exists():
        return {}
    return json.loads(METADATA_PATH.read_text())


def _training_frame(force: bool = False) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Returns (canonical_demand_frame, future_promotions_frame)."""
    try:
        raw, future_promotions = fetch_training_data(force=force)
    except TrainingDataUnavailable as error:
        raise EngineError(502, "TRAINING_DATA_UNAVAILABLE", str(error)) from error
    except RuntimeError as error:
        raise EngineError(500, "ENGINE_MISCONFIGURED", str(error)) from error
    return canonicalize_training_data(raw), future_promotions


@app.post("/forecast")
def forecast(request: ForecastRequest):
    if request.horizonDays > MAX_HORIZON_DAYS:
        raise EngineError(
            422,
            "HORIZON_TOO_LONG",
            f"horizonDays {request.horizonDays} exceeds the engine cap of {MAX_HORIZON_DAYS}",
        )

    seen = {(pair.productId, pair.warehouseId) for pair in request.pairs}
    if len(seen) != len(request.pairs):
        raise EngineError(422, "DUPLICATE_PAIRS", "pairs contains the same series twice")

    if not BUNDLE_PATH.exists():
        raise EngineError(
            500,
            "MODEL_NOT_TRAINED",
            "No model artifact. Train the engine first: python -m src.train_project",
        )

    canonical, future_promotions = _training_frame()
    index = pair_index(canonical)
    lookup = {
        (row.product_id, row.warehouse_id): (row.sku_id, row.dc_id)
        for row in index.itertuples()
    }

    # Every requested pair gets an entry, including ones the export has never seen -
    # Node rejects a response with a pair missing, and a short answer would fail the
    # whole planning run rather than one series.
    keys: list[tuple[str, str]] = []
    unknown: list[tuple[str, str]] = []
    for pair in request.pairs:
        cuids = (pair.productId, pair.warehouseId)
        readable = lookup.get(cuids)
        if readable is None:
            unknown.append(cuids)
            keys.append(("", ""))
        else:
            keys.append(readable)

    wanted = [key for key in keys if key != ("", "")]
    as_of = pd.Timestamp(request.asOf)

    try:
        bundle = load_bundle(BUNDLE_PATH)
        bands = forecast_series(
            canonical,
            wanted,
            as_of,
            request.horizonDays,
            bundle,
            float(_metadata().get("conformal_delta", 0.0)),
            future_promotions=future_promotions,
            future_signals=future_signals(),
        )
    except EngineError:
        raise
    except Exception as error:
        raise EngineError(500, "FORECAST_FAILED", f"{type(error).__name__}: {error}") from error

    start = (as_of + pd.Timedelta(days=1)).date().isoformat()
    zeros = [0.0] * request.horizonDays
    forecasts = []
    for pair, key in zip(request.pairs, keys):
        band = bands.get(key)
        forecasts.append(
            {
                "productId": pair.productId,
                "warehouseId": pair.warehouseId,
                "start": start,
                "p10": band.p10 if band else list(zeros),
                "p50": band.p50 if band else list(zeros),
                "p90": band.p90 if band else list(zeros),
            }
        )

    return {
        "modelVersion": _metadata().get("model_version", MODEL_VERSION),
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "horizonDays": request.horizonDays,
        "forecasts": forecasts,
        "unknownPairs": len(unknown),
    }


@app.post("/train")
def train(request: TrainRequest):
    canonical, _future_promotions = _training_frame(force=True)
    try:
        result = train_dataframe(
            canonical,
            ARTIFACTS_DIR,
            OUTPUTS_DIR,
            "express:/api/training-data",
            request.modelVersion,
        )
    except ValueError as error:
        raise EngineError(422, "TRAINING_FAILED", str(error)) from error
    except Exception as error:
        raise EngineError(500, "TRAINING_FAILED", f"{type(error).__name__}: {error}") from error
    point = result.get("xgboost", {})
    quantiles = result.get("quantile_forecasting", {})

    # A flat summary beside the full report: Express publishes these three, and
    # digging them out of a nested metrics tree in the caller would put knowledge of
    # this file's shape into another service.
    return {
        "status": "trained",
        "modelVersion": request.modelVersion,
        "trainingRecords": result.get("training_rows", 0),
        "testRecords": result.get("test_rows", 0),
        "calibrationOk": result.get("calibration_ok"),
        "summary": {
            "mae": point.get("MAE"),
            "rmse": point.get("RMSE"),
            "wape": point.get("wMAPE_percent"),
            "bias": point.get("bias_percent"),
            "coverage": quantiles.get("P10_P90_coverage_percent"),
        },
        "metrics": result,
    }


@app.get("/health")
def health():
    """200 only when the engine can also reach its data source.

    Express maps a non-2xx here to a `down` forecast dependency; an unset
    FORECAST_SERVICE_URL is `not_configured` on that side, not a failure.
    """
    ok, detail = reachable()
    body = {
        "status": "ok" if ok else "degraded",
        "service": "medcare-forecast-engine",
        "modelReady": BUNDLE_PATH.exists(),
        "modelVersion": _metadata().get("model_version"),
        "trainingData": {"reachable": ok, "detail": detail, **cache_state()},
    }
    return JSONResponse(status_code=200 if ok else 503, content=body)


@app.get("/model/metrics")
def model_metrics():
    if not METRICS_PATH.exists():
        raise EngineError(404, "METRICS_UNAVAILABLE", "Train the engine first")
    return json.loads(METRICS_PATH.read_text())
