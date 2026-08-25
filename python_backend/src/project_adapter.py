"""Adapter from MedCare Prisma/PostgreSQL data to the canonical ML schema."""
from __future__ import annotations
import pandas as pd


def canonicalize_project_history(df: pd.DataFrame) -> pd.DataFrame:
    required = ["date", "sku_id", "dc_id", "demand", "promotion_flag"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Project history missing columns: {missing}")
    x = df.copy()
    x["date"] = pd.to_datetime(x["date"], errors="coerce")
    x["demand"] = pd.to_numeric(x["demand"], errors="coerce").clip(lower=0)
    x["promotion_flag"] = pd.to_numeric(x["promotion_flag"], errors="coerce").fillna(0).astype(int).clip(0, 1)
    x = x.dropna(subset=["date", "sku_id", "dc_id", "demand"])
    x = (x.groupby(["date", "sku_id", "dc_id"], as_index=False)
           .agg(demand=("demand", "sum"), promotion_flag=("promotion_flag", "max")))
    # Historical numeric seasonality: SKU/DC monthly demand relative to its own mean.
    x["month"] = x["date"].dt.month
    overall = x.groupby(["sku_id", "dc_id"])['demand'].transform('mean').clip(lower=1e-8)
    monthly_mean = x.groupby(["sku_id", "dc_id", "month"])['demand'].transform('mean')
    x["seasonality_index"] = (monthly_mean / overall).clip(0.5, 2.0)
    return x.drop(columns=["month"]).sort_values(["sku_id", "dc_id", "date"]).reset_index(drop=True)
