"""Adapter from the Express NDJSON export to the canonical ML frame.

Column names follow doc/training.api.md. Both key forms travel on every row: read
`sku`/`dc`, write back `productId`/`warehouseId`.
"""
from __future__ import annotations

import pandas as pd

CANONICAL = ["date", "sku_id", "dc_id", "demand", "promotion_flag", "seasonality_index"]


def _seasonality_index(frame: pd.DataFrame) -> pd.Series:
    """Monthly demand for a series relative to that series' own mean."""
    month = frame["date"].dt.month
    overall = frame.groupby(["sku_id", "dc_id"])["demand"].transform("mean").clip(lower=1e-8)
    monthly = frame.assign(month=month).groupby(["sku_id", "dc_id", "month"])["demand"].transform("mean")
    return (monthly / overall).clip(0.5, 2.0)


def canonicalize_training_data(raw: pd.DataFrame) -> pd.DataFrame:
    """NDJSON rows -> the frame clean_data/add_features expect.

    `demand` is orderedQuantity, the uncensored signal. Fitting `fulfilled` instead
    would teach the model that a stockout was a quiet day.
    """
    required = ["date", "sku", "dc", "demand", "productId", "warehouseId"]
    missing = [column for column in required if column not in raw.columns]
    if missing:
        raise ValueError(f"training-data missing columns: {missing}")

    frame = pd.DataFrame(
        {
            "date": pd.to_datetime(raw["date"], errors="coerce"),
            "sku_id": raw["sku"].astype(str),
            "dc_id": raw["dc"].astype(str),
            "product_id": raw["productId"].astype(str),
            "warehouse_id": raw["warehouseId"].astype(str),
            "demand": pd.to_numeric(raw["demand"], errors="coerce").clip(lower=0),
            "promotion_flag": raw.get("promotion", False).astype(bool).astype(int),
            "holiday_flag": raw.get("holiday", False).astype(bool).astype(int),
            "stockout_flag": raw.get("stockout", False).astype(bool).astype(int),
        }
    ).dropna(subset=["date", "demand"])

    frame = frame.sort_values(["sku_id", "dc_id", "date"]).reset_index(drop=True)
    frame["seasonality_index"] = _seasonality_index(frame)
    return frame


def pair_index(canonical: pd.DataFrame) -> pd.DataFrame:
    """One row per series: the cuid pair the backend asked for, and its readable keys."""
    return (
        canonical[["product_id", "warehouse_id", "sku_id", "dc_id"]]
        .drop_duplicates()
        .reset_index(drop=True)
    )
