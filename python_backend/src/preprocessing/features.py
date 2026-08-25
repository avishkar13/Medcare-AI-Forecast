
import numpy as np
import pandas as pd

REQ = [
    "date","sku_id","dc_id","demand","promotion_flag","seasonality_index"
]

def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    miss=[c for c in REQ if c not in df.columns]
    if miss:
        raise ValueError(f"Missing required columns: {miss}")
    x=df.copy()
    x["date"]=pd.to_datetime(x["date"], errors="coerce")
    for c in REQ[3:]:
        x[c]=pd.to_numeric(x[c], errors="coerce")
    x=x.dropna(subset=["date","sku_id","dc_id","demand"])
    x["demand"]=x["demand"].clip(lower=0)
    x["promotion_flag"]=x["promotion_flag"].fillna(0).astype(int).clip(0,1)
    x["seasonality_index"]=x["seasonality_index"].replace([np.inf,-np.inf],np.nan).fillna(1.0)
    # Demand is the series-level truth. Aggregate accidental duplicate rows safely.
    x=(x.groupby(["date","sku_id","dc_id"],as_index=False)
         .agg(demand=("demand","sum"),
              promotion_flag=("promotion_flag","max"),
              seasonality_index=("seasonality_index","mean"))
         .sort_values(["date","sku_id","dc_id"])
         .reset_index(drop=True))
    return x

def add_features(df: pd.DataFrame, training=True) -> pd.DataFrame:
    x=df.copy().sort_values(["sku_id","dc_id","date"]).reset_index(drop=True)
    g=x.groupby(["sku_id","dc_id"], sort=False)

    # Strictly historical demand features.
    sh=g["demand"].shift(1)
    for lag in [1,2,3,7,14,21,28]:
        x[f"demand_lag_{lag}"]=g["demand"].shift(lag)

    # Rolling features use shifted demand, preventing target leakage.
    sg=sh.groupby([x["sku_id"],x["dc_id"]], sort=False)
    for w in [3,7,14,28]:
        x[f"rolling_mean_{w}"]=sg.transform(lambda s:s.rolling(w,min_periods=2).mean())
        x[f"rolling_median_{w}"]=sg.transform(lambda s:s.rolling(w,min_periods=2).median())
    for w in [7,14,28]:
        x[f"rolling_std_{w}"]=sg.transform(lambda s:s.rolling(w,min_periods=2).std())
    x["ewm_7"]=sg.transform(lambda s:s.ewm(span=7,adjust=False,min_periods=2).mean())

    # Trend / acceleration.
    x["demand_velocity"]=x["rolling_mean_7"]-x["rolling_mean_28"]
    x["demand_acceleration"]=x["rolling_mean_7"]-x["rolling_mean_14"]
    x["demand_cv_28"]=x["rolling_std_28"]/x["rolling_mean_28"].replace(0,np.nan)

    # Time / seasonality features.
    x["day_of_week"]=x.date.dt.dayofweek
    x["week_of_year"]=x.date.dt.isocalendar().week.astype(int)
    x["month"]=x.date.dt.month
    x["quarter"]=x.date.dt.quarter
    x["day_of_month"]=x.date.dt.day
    x["day_of_year"]=x.date.dt.dayofyear
    x["is_weekend"]=(x.day_of_week>=5).astype(int)
    x["dow_sin"]=np.sin(2*np.pi*x.day_of_week/7)
    x["dow_cos"]=np.cos(2*np.pi*x.day_of_week/7)
    x["doy_sin"]=np.sin(2*np.pi*x.day_of_year/365.25)
    x["doy_cos"]=np.cos(2*np.pi*x.day_of_year/365.25)

    # Exogenous interactions.
    x["promotion_seasonality"]=x.promotion_flag*x.seasonality_index
    x["promotion_recent_rate"]=(
        x.groupby("sku_id")["promotion_flag"]
         .transform(lambda s:s.shift(1).rolling(28,min_periods=3).mean())
    )


    if training:
        needed=[
            c for c in feature_columns()
            if c not in ["sku_id","dc_id"]
        ]+["demand"]
        x=x.replace([np.inf,-np.inf],np.nan).dropna(subset=needed).reset_index(drop=True)
    return x

def feature_columns():
    return [
        "sku_id","dc_id","promotion_flag","seasonality_index","demand_lag_1","demand_lag_2","demand_lag_3","demand_lag_7",
        "demand_lag_14","demand_lag_21","demand_lag_28",
        "rolling_mean_3","rolling_mean_7","rolling_mean_14","rolling_mean_28",
        "rolling_median_7","rolling_median_28","rolling_std_7","rolling_std_14",
        "rolling_std_28","ewm_7","demand_velocity","demand_acceleration","demand_cv_28",
        "day_of_week","week_of_year","month","quarter","day_of_month","day_of_year",
        "is_weekend","dow_sin","dow_cos","doy_sin","doy_cos",
        "promotion_seasonality","promotion_recent_rate"
    ]
