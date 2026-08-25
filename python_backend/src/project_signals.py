"""Future exogenous signals, derived from history alone.

The engine has no database and the training export carries no forward-dated events,
so future promotion flags are 0 rather than invented. Seasonality is what the series
itself did on that weekday and in that month.
"""
from __future__ import annotations

import pandas as pd


def _index_by(frame: pd.DataFrame, key: pd.Series) -> pd.Series:
    overall = float(frame["demand"].mean()) if len(frame) else 1.0
    if overall <= 0:
        return pd.Series(dtype=float)
    return frame.groupby(key)["demand"].mean() / overall


def seasonality_profile(history: pd.DataFrame) -> dict:
    """Weekday and month indices for one series, centred on 1.0."""
    if history.empty:
        return {"weekday": {}, "month": {}}
    weekday = _index_by(history, history["date"].dt.dayofweek)
    month = _index_by(history, history["date"].dt.month)
    return {
        "weekday": {int(k): float(v) for k, v in weekday.items()},
        "month": {int(k): float(v) for k, v in month.items()},
    }


def seasonality_for(profile: dict, day: pd.Timestamp) -> float:
    month = float(profile["month"].get(int(day.month), 1.0))
    weekday = float(profile["weekday"].get(int(day.dayofweek), 1.0))
    return max(0.5, min(2.0, 0.75 * month + 0.25 * weekday))


def future_frame(profiles: dict, keys: list[tuple[str, str]], day: pd.Timestamp) -> pd.DataFrame:
    """One placeholder row per series for a single future day."""
    return pd.DataFrame(
        [
            {
                "date": day,
                "sku_id": sku,
                "dc_id": dc,
                "demand": float("nan"),
                "promotion_flag": 0,
                "seasonality_index": seasonality_for(profiles[(sku, dc)], day),
            }
            for sku, dc in keys
        ]
    )
