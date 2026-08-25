"""Recursive multi-series forecasting.

One pass per horizon day across every requested series, not one pass per series. The
features are lag-based, so day d+1 needs day d's prediction; doing that per series
would mean rebuilding the whole feature frame thousands of times.
"""
from __future__ import annotations

from dataclasses import dataclass

from typing import Optional

import numpy as np
import pandas as pd

from src.config import MIN_HISTORY_DAYS
from src.preprocessing.features import add_features, feature_columns
from src.project_signals import build_signal_lookup, future_frame, seasonality_profile

# Enough to fill the longest lag (28) and the longest rolling window (28) with room
# to spare. The working frame is trimmed back to this after every step, so the cost
# of a horizon is linear in its length rather than quadratic.
WINDOW_DAYS = 60

# What a series with too little history to feature-engineer gets instead: a weekday
# profile around its own recent level. Wide, honest, and never negative.
FALLBACK_SPREAD = 0.40


@dataclass(frozen=True)
class Band:
    p10: list[float]
    p50: list[float]
    p90: list[float]


def _densify(series: pd.DataFrame, as_of: pd.Timestamp) -> pd.DataFrame:
    """Fill missing calendar days with zero demand.

    A gap is a day nobody ordered, not a day that did not exist. Left as a gap it
    would silently shorten every lag that crosses it.
    """
    if series.empty:
        return series
    span = pd.date_range(series["date"].min(), as_of, freq="D")
    filled = (
        series.set_index("date")
        .reindex(span)
        .rename_axis("date")
        .reset_index()
    )
    filled["sku_id"] = series["sku_id"].iloc[0]
    filled["dc_id"] = series["dc_id"].iloc[0]
    filled["demand"] = filled["demand"].fillna(0.0)
    filled["promotion_flag"] = filled["promotion_flag"].fillna(0).astype(int)
    filled["seasonality_index"] = filled["seasonality_index"].ffill().bfill().fillna(1.0)
    filled["promotion_uplift"] = filled["promotion_uplift"].fillna(1.0) if "promotion_uplift" in filled.columns else 1.0
    filled["demand_signal_value"] = filled["demand_signal_value"].fillna(0.0) if "demand_signal_value" in filled.columns else 0.0
    return filled


def _clamp(p10: np.ndarray, p50: np.ndarray, p90: np.ndarray) -> tuple[np.ndarray, ...]:
    """p10 <= p50 <= p90, all finite and >= 0.

    Quantile models are fitted independently and can cross. Node rejects the whole
    response on a crossed band, so the ordering is enforced here rather than hoped for.
    """
    p50 = np.nan_to_num(np.maximum(0.0, p50), nan=0.0, posinf=0.0, neginf=0.0)
    p10 = np.nan_to_num(p10, nan=0.0, posinf=0.0, neginf=0.0)
    p90 = np.nan_to_num(p90, nan=0.0, posinf=0.0, neginf=0.0)
    return np.clip(np.minimum(p10, p50), 0.0, None), p50, np.maximum(p90, p50)


def _fallback(history: pd.DataFrame, days: list[pd.Timestamp]) -> Band:
    if history.empty:
        zeros = [0.0] * len(days)
        return Band(p10=list(zeros), p50=list(zeros), p90=list(zeros))

    recent = history.sort_values("date").tail(28)
    level = float(recent["demand"].mean())
    profile = seasonality_profile(history)
    weekday = profile["weekday"]

    p50 = np.array(
        [max(0.0, level * float(weekday.get(int(day.dayofweek), 1.0))) for day in days]
    )
    p10, p50, p90 = _clamp(p50 * (1 - FALLBACK_SPREAD), p50, p50 * (1 + FALLBACK_SPREAD))
    return Band(p10=p10.round(3).tolist(), p50=p50.round(3).tolist(), p90=p90.round(3).tolist())


def forecast_series(
    canonical: pd.DataFrame,
    keys: list[tuple[str, str]],
    as_of: pd.Timestamp,
    horizon_days: int,
    bundle: dict,
    conformal_delta: float,
    future_promotions: Optional[pd.DataFrame] = None,
    future_signals: Optional[pd.DataFrame] = None,
) -> dict[tuple[str, str], Band]:
    """A band per requested (sku, dc) key. Every key gets an entry, always."""
    days = [as_of + pd.Timedelta(days=step) for step in range(1, horizon_days + 1)]
    history = canonical[canonical["date"] <= as_of]
    grouped = {key: frame for key, frame in history.groupby(["sku_id", "dc_id"], sort=False)}

    modelled: list[tuple[str, str]] = []
    bands: dict[tuple[str, str], Band] = {}
    windows: list[pd.DataFrame] = []

    for key in keys:
        series = grouped.get(key, pd.DataFrame(columns=canonical.columns))
        if len(series) < MIN_HISTORY_DAYS:
            bands[key] = _fallback(series, days)
            continue
        dense = _densify(
            series[["date", "sku_id", "dc_id", "demand", "promotion_flag", "seasonality_index",
                    "promotion_uplift", "demand_signal_value"]].copy(),
            as_of,
        )
        windows.append(dense.tail(WINDOW_DAYS))
        modelled.append(key)

    if not modelled:
        return bands

    work = pd.concat(windows, ignore_index=True)
    profiles = {key: seasonality_profile(grouped[key]) for key in modelled}

    # Each series belongs to one region, and the indicator is published per region.
    # The last historical reading per region is the fallback once the published
    # horizon runs out.
    regions = {}
    last_by_region: dict = {}
    # PromotionEvent is scoped by cuid, while a series is keyed by sku/code. Without
    # this map only globally-scoped promotions ever match, and every product-specific
    # campaign is silently missed.
    pair_index: dict = {}
    for key in modelled:
        frame = grouped[key]
        region = frame["region"].iloc[-1] if "region" in frame.columns and len(frame) else None
        regions[key] = region
        if "demand_signal_value" in frame.columns and len(frame):
            last_by_region.setdefault(region, float(frame["demand_signal_value"].iloc[-1]))
        if {"product_id", "warehouse_id"} <= set(frame.columns) and len(frame):
            pair_index[key] = (frame["product_id"].iloc[-1], frame["warehouse_id"].iloc[-1])
    signal_lookup = build_signal_lookup(future_signals, last_by_region)
    columns = feature_columns()
    index = pd.MultiIndex.from_tuples(modelled, names=["sku_id", "dc_id"])
    collected = {key: {"p10": [], "p50": [], "p90": []} for key in modelled}

    for day in days:
        work = pd.concat(
            [
                work,
                future_frame(
                    profiles, modelled, day, future_promotions,
                    pair_index=pair_index,
                    signal_lookup=signal_lookup, regions=regions,
                ),
            ],
            ignore_index=True,
        )
        featured = add_features(work, training=False)
        rows = (
            featured[featured["date"] == day]
            .set_index(["sku_id", "dc_id"])
            .reindex(index)
            .reset_index()
        )

        frame = rows[columns]
        # The centre is the point model, not q50. The planner reads p50 as average
        # daily demand, and reg:quantileerror at alpha=0.5 predicts the median - which
        # sits below the mean on skewed demand and quietly under-sizes safety stock.
        p10, p50, p90 = _clamp(
            bundle["q10"].predict(frame) - conformal_delta,
            bundle["point"].predict(frame),
            bundle["q90"].predict(frame) + conformal_delta,
        )

        for position, key in enumerate(modelled):
            collected[key]["p10"].append(round(float(p10[position]), 3))
            collected[key]["p50"].append(round(float(p50[position]), 3))
            collected[key]["p90"].append(round(float(p90[position]), 3))

        # Tomorrow's lags are today's prediction. p50 is the point estimate; feeding
        # p90 back would compound the upper tail into a runaway trend.
        work.iloc[-len(modelled):, work.columns.get_loc("demand")] = p50

        # groupby.tail keeps the original row order, so the day just appended stays
        # last - which is what the assignment above relies on.
        work = work.groupby(["sku_id", "dc_id"], sort=False).tail(WINDOW_DAYS).reset_index(drop=True)

    for key in modelled:
        bands[key] = Band(**collected[key])
    return bands
