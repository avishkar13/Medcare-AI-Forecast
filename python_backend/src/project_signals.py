"""Future signals derived from the MedCare project's database."""
from __future__ import annotations

from datetime import datetime
import numpy as np
import pandas as pd

from src.data_project import load_future_promotions


def build_future_signals(history: pd.DataFrame, sku: str, dc: str, dates) -> pd.DataFrame:
    dates = pd.to_datetime(dates)
    h = history.copy()
    h["date"] = pd.to_datetime(h["date"])
    h["month"] = h.date.dt.month
    h["dow"] = h.date.dt.dayofweek

    # SKU/DC monthly seasonality relative to its own historical mean.
    overall = float(h.demand.mean()) if len(h) else 1.0
    monthly = h.groupby("month").demand.mean() / max(overall, 1e-8)
    dow = h.groupby("dow").demand.mean() / max(overall, 1e-8)

    start = dates.min().to_pydatetime()
    end = dates.max().to_pydatetime()
    events = load_future_promotions(sku, dc, start, end)
    if not events.empty:
        events["start_date"] = pd.to_datetime(events.start_date)
        events["end_date"] = pd.to_datetime(events.end_date)

    promotion = []
    uplift = []
    seasonality = []
    for d in dates:
        active = False
        max_uplift = 1.0
        if not events.empty:
            mask = (events.start_date.dt.date <= d.date()) & (events.end_date.dt.date >= d.date())
            if mask.any():
                active = True
                max_uplift = float(events.loc[mask, "uplift_factor"].max())
        # Blend monthly and weekday seasonality. This is a feature signal, not an inventory decision.
        s_month = float(monthly.get(int(d.month), 1.0))
        s_dow = float(dow.get(int(d.dayofweek), 1.0))
        s = max(0.5, min(2.0, 0.75 * s_month + 0.25 * s_dow))
        if active:
            s *= max(1.0, min(max_uplift, 3.0))
        seasonality.append(s)
        promotion.append(int(active))
        uplift.append(max_uplift if active else 1.0)

    return pd.DataFrame({
        "date": dates,
        "promotion_flag": promotion,
        "seasonality_index": seasonality,
        "promotion_uplift": uplift,
    })
