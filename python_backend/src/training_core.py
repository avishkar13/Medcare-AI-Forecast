from pathlib import Path
import json
import numpy as np
import pandas as pd
from sklearn.model_selection import TimeSeriesSplit

from src.preprocessing.features import clean_data, add_features, feature_columns
from src.evaluation.metrics import metrics, pinball_loss, interval_coverage
from src.models.model import build_point, build_quantile, save_bundle


def moving_average_predictions(train_df, val_df, window=7):
    out = []
    for _, r in val_df.iterrows():
        h = train_df[(train_df.sku_id == r.sku_id) & (train_df.dc_id == r.dc_id)].sort_values("date").tail(window)
        out.append(float(h.demand.mean()) if len(h) else float(train_df.demand.mean()))
    return np.array(out)


def train_dataframe(raw: pd.DataFrame, artifacts_dir: Path, outputs_dir: Path, source: str, model_version: str):
    clean = clean_data(raw)
    f = add_features(clean, training=True)
    cols = feature_columns()
    if f.empty:
        raise ValueError("No training rows remain after feature engineering.")

    dates = np.array(sorted(f.date.unique()))
    if len(dates) < 10:
        raise ValueError("At least 10 unique dates are required for training.")
    cutoff_date = pd.Timestamp(dates[max(1, int(len(dates) * .80))])
    tr = f[f.date < cutoff_date].copy()
    te = f[f.date >= cutoff_date].copy()
    if len(tr) < 100 or len(te) < 30:
        raise ValueError("Project dataset is too small for a reliable train/test split.")

    base = moving_average_predictions(tr, te)
    point = build_point(cols)
    point.fit(tr[cols], tr.demand)
    pred = np.maximum(0, point.predict(te[cols]))

    unique_dates = np.array(sorted(tr.date.unique()))
    cv_metrics = []
    n_splits = 3 if len(unique_dates) >= 30 else 2
    tscv = TimeSeriesSplit(n_splits=n_splits)
    for fold, (a, b) in enumerate(tscv.split(unique_dates), 1):
        train_dates, val_dates = unique_dates[a], unique_dates[b]
        fold_tr = tr[tr.date.isin(train_dates)]
        fold_va = tr[tr.date.isin(val_dates)]
        if len(fold_tr) < 100 or len(fold_va) < 30:
            continue
        fm = build_point(cols)
        fm.fit(fold_tr[cols], fold_tr.demand)
        fp = np.maximum(0, fm.predict(fold_va[cols]))
        mm = metrics(fold_va.demand, fp)
        mm["fold"] = fold
        cv_metrics.append(mm)

    # Leakage-safe conformal calibration: fit only on an earlier slice of training data.
    cal_cut = int(len(tr) * .80)
    qfit = tr.iloc[:cal_cut]
    qcal = tr.iloc[cal_cut:]
    cal_model = build_point(cols)
    cal_model.fit(qfit[cols], qfit.demand)
    cal_pred = np.maximum(0, cal_model.predict(qcal[cols]))
    abs_residual = np.abs(qcal.demand.to_numpy() - cal_pred)
    alpha = 0.20
    qlevel = min(1.0, (1 - alpha) * (len(abs_residual) + 1) / max(len(abs_residual), 1))
    conformal_delta = float(np.quantile(abs_residual, qlevel)) if len(abs_residual) else 0.0

    q10, q50, q90 = build_quantile(cols, .10), build_quantile(cols, .50), build_quantile(cols, .90)
    for q in (q10, q50, q90):
        q.fit(tr[cols], tr.demand)
    lo = np.maximum(0, q10.predict(te[cols]) - conformal_delta)
    med = np.maximum(0, q50.predict(te[cols]))
    hi = np.maximum(med, q90.predict(te[cols]) + conformal_delta)
    lo, hi = np.minimum(lo, med), np.maximum(hi, med)

    artifacts_dir.mkdir(parents=True, exist_ok=True)
    outputs_dir.mkdir(parents=True, exist_ok=True)
    save_bundle({"point": point, "q10": q10, "q50": q50, "q90": q90}, artifacts_dir / "forecast_pipeline.joblib")

    point_metrics = metrics(te.demand, pred)
    baseline_metrics = metrics(te.demand, base)
    quantile_metrics = {
        "P10_pinball": pinball_loss(te.demand, lo, .10),
        "P50_pinball": pinball_loss(te.demand, med, .50),
        "P90_pinball": pinball_loss(te.demand, hi, .90),
        "P10_P90_coverage_percent": interval_coverage(te.demand, lo, hi) * 100,
    }
    meta = {
        "production_model": "XGBoost + Quantile XGBoost",
        "model_version": model_version,
        "data_source": source,
        "feature_columns": cols,
        "cutoff": str(cutoff_date.date()),
        "uncertainty_method": "direct quantile regression + conformal calibration",
        "quantiles": [0.10, 0.50, 0.90],
        "interval_method": "conformalized quantile regression",
        "conformal_delta": conformal_delta,
        "cv_folds": len(cv_metrics),
        "p10_p90_coverage_percent": quantile_metrics["P10_P90_coverage_percent"],
        "training_rows": int(len(tr)),
        "test_rows": int(len(te)),
        "unique_skus": int(clean.sku_id.nunique()),
        "unique_warehouses": int(clean.dc_id.nunique()),
    }
    (artifacts_dir / "model_metadata.json").write_text(json.dumps(meta, indent=2))
    result = {
        "baseline_7_day_moving_average": baseline_metrics,
        "xgboost": point_metrics,
        "quantile_forecasting": quantile_metrics,
        "rolling_time_series_cv": cv_metrics,
        "selected_model_by_mae": "XGBoost",
        "production_model": "XGBoost + Quantile XGBoost",
        "model_version": model_version,
        "data_source": source,
    }
    (outputs_dir / "model_metrics.json").write_text(json.dumps(result, indent=2))
    o = te[["date", "sku_id", "dc_id", "demand"]].copy()
    o["baseline_7d"], o["xgboost"] = base, pred
    o["p10"], o["p50"], o["p90"] = lo, med, hi
    o["absolute_error"] = np.abs(o.demand - o.xgboost)
    o.to_csv(outputs_dir / "test_predictions.csv", index=False)
    return result
