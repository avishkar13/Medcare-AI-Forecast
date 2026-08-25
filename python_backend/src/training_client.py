"""The engine's only data source: GET {API_BASE_URL}/training-data.

NDJSON, one row per product per warehouse per day. See doc/training.api.md in the
Express backend for the field list and doc/forecast.contract.md for why this is the
single path for both fitting and inference.

The stream now also carries future PromotionEvent rows (discriminated by
``_type: "future_promotion"``) and inline DemandSignal/PromotionEvent enrichments
on every demand-history row.
"""
from __future__ import annotations

import json
import time
from typing import Optional

import httpx
import pandas as pd

from src.config import (
    TRAINING_CACHE_TTL_SECONDS,
    TRAINING_TIMEOUT_SECONDS,
    api_base_url,
)

ROW_COUNT_HEADER = "x-training-rows"
FUTURE_PROMOTIONS_HEADER = "x-future-promotions"

COLUMNS = [
    "date",
    "sku",
    "productId",
    "dc",
    "warehouseId",
    "demand",
    "fulfilled",
    "stockout",
    "promotion",
    "holiday",
    "season",
    # New enrichment fields (may be null/absent on older backends)
    "promotionUplift",
    "promotionType",
    "demandSignalType",
    "demandSignalValue",
]

FUTURE_PROMO_COLUMNS = [
    "productId",
    "warehouseId",
    "startDate",
    "endDate",
    "type",
    "upliftFactor",
    "name",
]


class TrainingDataUnavailable(RuntimeError):
    """The export could not be fetched, parsed, or trusted."""


FUTURE_SIGNAL_COLUMNS = ["region", "date", "signalType", "value"]

_cache: dict[str, object] = {
    "frame": None,
    "future_promotions": None,
    "future_signals": None,
    "fetched_at": 0.0,
    "rows": 0,
}


def _parse_ndjson(
    body: str, declared_rows: Optional[int]
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Parse the NDJSON stream into demand-history and future-promotion frames."""
    demand_records: list[dict] = []
    promo_records: list[dict] = []
    signal_records: list[dict] = []

    for number, line in enumerate(body.splitlines(), 1):
        line = line.strip()
        if not line:
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError as error:
            raise TrainingDataUnavailable(
                f"training-data line {number} is not valid JSON: {error}"
            ) from error

        kind = row.get("_type")
        if kind == "future_promotion":
            promo_records.append(row)
        elif kind == "future_signal":
            signal_records.append(row)
        elif kind is None:
            demand_records.append(row)
        else:
            # An unknown trailer from a newer backend. Ignoring it keeps this client
            # forward-compatible; counting it as history would fail the row check.
            continue

    # A stream cut short by a timeout is still syntactically valid NDJSON. Comparing
    # the header to what parsed is the only way to notice we trained on half a dataset.
    # x-training-rows only counts demand rows, not future promotions.
    if declared_rows is not None and declared_rows != len(demand_records):
        raise TrainingDataUnavailable(
            f"training-data was truncated: {ROW_COUNT_HEADER} said {declared_rows}, "
            f"parsed {len(demand_records)}"
        )

    if not demand_records:
        raise TrainingDataUnavailable("training-data returned no rows")

    frame = pd.DataFrame.from_records(demand_records)
    # Only check the original required columns — new fields are optional
    required = ["date", "sku", "productId", "dc", "warehouseId", "demand"]
    missing = [column for column in required if column not in frame.columns]
    if missing:
        raise TrainingDataUnavailable(f"training-data is missing columns: {missing}")

    future_promotions = (
        pd.DataFrame.from_records(promo_records, columns=FUTURE_PROMO_COLUMNS)
        if promo_records
        else pd.DataFrame(columns=FUTURE_PROMO_COLUMNS)
    )

    future_signals = (
        pd.DataFrame.from_records(signal_records, columns=FUTURE_SIGNAL_COLUMNS)
        if signal_records
        else pd.DataFrame(columns=FUTURE_SIGNAL_COLUMNS)
    )
    _cache["future_signals"] = future_signals

    return frame, future_promotions


def fetch_training_data(
    force: bool = False,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """The full export, cached. One pull covers every pair; never pull per pair.

    Returns (demand_frame, future_promotions_frame).
    """
    age = time.time() - float(_cache["fetched_at"])
    cached = _cache["frame"]
    cached_promos = _cache["future_promotions"]
    if cached is not None and cached_promos is not None and not force and age < TRAINING_CACHE_TTL_SECONDS:
        return cached, cached_promos  # type: ignore[return-value]

    url = f"{api_base_url()}/training-data"
    try:
        with httpx.Client(timeout=TRAINING_TIMEOUT_SECONDS, follow_redirects=True) as client:
            response = client.get(url, headers={"accept": "application/x-ndjson"})
    except httpx.HTTPError as error:
        raise TrainingDataUnavailable(f"{url} is unreachable: {error}") from error

    if response.status_code != 200:
        # An error body is the standard JSON envelope, not NDJSON.
        detail = response.text[:300]
        raise TrainingDataUnavailable(
            f"{url} answered {response.status_code}: {detail}"
        )

    declared = response.headers.get(ROW_COUNT_HEADER)
    frame, future_promotions = _parse_ndjson(
        response.text, int(declared) if declared else None
    )

    _cache["frame"] = frame
    _cache["future_promotions"] = future_promotions
    _cache["fetched_at"] = time.time()
    _cache["rows"] = len(frame)
    return frame, future_promotions


def future_signals() -> pd.DataFrame:
    """Signals dated past the end of history, from the last pull.

    These are what make DemandSignal a *leading* indicator: flu incidence is published
    ahead of the demand it drives, so a forecast horizon needs its own values rather
    than the last historical one carried forward.
    """
    cached = _cache.get("future_signals")
    if cached is None:
        return pd.DataFrame(columns=FUTURE_SIGNAL_COLUMNS)
    return cached  # type: ignore[return-value]


def cache_state() -> dict:
    return {
        "rows": int(_cache["rows"]),
        "age_seconds": (
            None
            if _cache["frame"] is None
            else round(time.time() - float(_cache["fetched_at"]), 1)
        ),
        "ttl_seconds": TRAINING_CACHE_TTL_SECONDS,
    }


def reachable() -> tuple[bool, str]:
    """Cheap liveness probe for /health. Uses the cache when it is still warm."""
    if _cache["frame"] is not None and (
        time.time() - float(_cache["fetched_at"]) < TRAINING_CACHE_TTL_SECONDS
    ):
        return True, "cached"
    try:
        fetch_training_data()
        return True, "fetched"
    except (TrainingDataUnavailable, RuntimeError) as error:
        return False, str(error)

