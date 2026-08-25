"""The engine's only data source: GET {API_BASE_URL}/training-data.

NDJSON, one row per product per warehouse per day. See doc/training.api.md in the
Express backend for the field list and doc/forecast.contract.md for why this is the
single path for both fitting and inference.
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
]


class TrainingDataUnavailable(RuntimeError):
    """The export could not be fetched, parsed, or trusted."""


_cache: dict[str, object] = {"frame": None, "fetched_at": 0.0, "rows": 0}


def _parse_ndjson(body: str, declared_rows: Optional[int]) -> pd.DataFrame:
    records = []
    for number, line in enumerate(body.splitlines(), 1):
        line = line.strip()
        if not line:
            continue
        try:
            records.append(json.loads(line))
        except json.JSONDecodeError as error:
            raise TrainingDataUnavailable(
                f"training-data line {number} is not valid JSON: {error}"
            ) from error

    # A stream cut short by a timeout is still syntactically valid NDJSON. Comparing
    # the header to what parsed is the only way to notice we trained on half a dataset.
    if declared_rows is not None and declared_rows != len(records):
        raise TrainingDataUnavailable(
            f"training-data was truncated: {ROW_COUNT_HEADER} said {declared_rows}, "
            f"parsed {len(records)}"
        )

    if not records:
        raise TrainingDataUnavailable("training-data returned no rows")

    frame = pd.DataFrame.from_records(records)
    missing = [column for column in COLUMNS if column not in frame.columns]
    if missing:
        raise TrainingDataUnavailable(f"training-data is missing columns: {missing}")
    return frame


def fetch_training_data(force: bool = False) -> pd.DataFrame:
    """The full export, cached. One pull covers every pair; never pull per pair."""
    age = time.time() - float(_cache["fetched_at"])
    cached = _cache["frame"]
    if cached is not None and not force and age < TRAINING_CACHE_TTL_SECONDS:
        return cached  # type: ignore[return-value]

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
    frame = _parse_ndjson(response.text, int(declared) if declared else None)

    _cache["frame"] = frame
    _cache["fetched_at"] = time.time()
    _cache["rows"] = len(frame)
    return frame


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
