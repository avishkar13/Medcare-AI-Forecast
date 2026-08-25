"""Future exogenous signals, derived from history and future promotion events.

The engine has no database, but the training export now carries forward-dated
PromotionEvent rows (``_type: "future_promotion"``). When available, future
promotion flags are set from those events rather than defaulted to 0.
Seasonality is what the series itself did on that weekday and in that month.
"""
from __future__ import annotations

from typing import Optional

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


def _build_promo_lookup(
    future_promotions: Optional[pd.DataFrame],
) -> dict[tuple[str, str, str], float]:
    """Build a lookup of (productId, warehouseId, date) -> upliftFactor.

    PromotionEvents with null productId/warehouseId are "global" and apply to all
    matching series. We expand them into daily entries for fast O(1) lookup.
    """
    lookup: dict[tuple[str, str, str], float] = {}
    if future_promotions is None or future_promotions.empty:
        return lookup

    for _, row in future_promotions.iterrows():
        start = pd.Timestamp(row["startDate"])
        end = pd.Timestamp(row["endDate"])
        pid = str(row.get("productId", "") or "*")
        wid = str(row.get("warehouseId", "") or "*")
        uplift = float(row.get("upliftFactor", 1.0))
        for day in pd.date_range(start, end, freq="D"):
            day_str = day.strftime("%Y-%m-%d")
            # Keep highest uplift when multiple promos overlap
            key = (pid, wid, day_str)
            if key not in lookup or uplift > lookup[key]:
                lookup[key] = uplift
    return lookup


def _find_promo(
    lookup: dict[tuple[str, str, str], float],
    sku: str,
    dc: str,
    day_str: str,
    pair_index: Optional[dict] = None,
) -> tuple[int, float]:
    """Look up whether a future promotion applies to this (sku, dc) on this day.

    Returns (promotion_flag, promotion_uplift).
    """
    # The lookup is keyed by (productId, warehouseId, date). We need to convert
    # (sku, dc) to (productId, warehouseId) if a pair_index is provided.
    # If not, we just check wildcard matches.
    pid = pair_index.get((sku, dc), ("*", "*"))[0] if pair_index else "*"
    wid = pair_index.get((sku, dc), ("*", "*"))[1] if pair_index else "*"

    # Priority: exact > product-only > warehouse-only > global
    uplift = (
        lookup.get((pid, wid, day_str))
        or lookup.get((pid, "*", day_str))
        or lookup.get(("*", wid, day_str))
        or lookup.get(("*", "*", day_str))
    )

    if uplift is not None:
        return 1, uplift
    return 0, 1.0


def build_signal_lookup(
    future_signals: Optional[pd.DataFrame],
    last_known: Optional[dict] = None,
) -> dict:
    """(region, YYYY-MM-DD) -> signal value, plus a per-region fallback.

    The fallback is the last value observed in history. Beyond the published horizon
    an indicator has no forecast of its own, so persisting the last reading is the
    honest choice - and it is still far better than the 0.0 that used to be sent,
    which is outside the range the model ever trained on and drags every prediction
    down.
    """
    lookup: dict = {"by_day": {}, "last": dict(last_known or {})}
    if future_signals is None or len(future_signals) == 0:
        return lookup

    for row in future_signals.itertuples():
        region = getattr(row, "region", None)
        day = str(getattr(row, "date", ""))[:10]
        try:
            value = float(getattr(row, "value"))
        except (TypeError, ValueError):
            continue
        lookup["by_day"][(region, day)] = value
    return lookup


def signal_for(lookup: dict, region, day_str: str) -> float:
    if not lookup:
        return 0.0
    value = lookup["by_day"].get((region, day_str))
    if value is not None:
        return value
    return float(lookup["last"].get(region, 0.0))


def future_frame(
    profiles: dict,
    keys: list[tuple[str, str]],
    day: pd.Timestamp,
    future_promotions: Optional[pd.DataFrame] = None,
    pair_index: Optional[dict] = None,
    signal_lookup: Optional[dict] = None,
    regions: Optional[dict] = None,
) -> pd.DataFrame:
    """One placeholder row per series for a single future day.

    If future_promotions is provided, sets promotion_flag=1 and promotion_uplift
    for days that fall within a scheduled promotion. Otherwise defaults to 0/1.0.
    """
    promo_lookup = _build_promo_lookup(future_promotions)
    day_str = day.strftime("%Y-%m-%d")

    rows = []
    for sku, dc in keys:
        promo_flag, promo_uplift = _find_promo(promo_lookup, sku, dc, day_str, pair_index)
        rows.append(
            {
                "date": day,
                "sku_id": sku,
                "dc_id": dc,
                "demand": float("nan"),
                "promotion_flag": promo_flag,
                "seasonality_index": seasonality_for(profiles[(sku, dc)], day),
                "promotion_uplift": promo_uplift,
                "demand_signal_value": signal_for(
                    signal_lookup or {}, (regions or {}).get((sku, dc)), day_str
                ),
            }
        )
    return pd.DataFrame(rows)

