from pathlib import Path
import json
import numpy as np
import pandas as pd
from sklearn.model_selection import TimeSeriesSplit

from src.preprocessing.features import clean_data, add_features, feature_columns
from src.evaluation.metrics import metrics, pinball_loss, interval_coverage
from src.models.model import build_point, build_quantile, save_bundle


# A nominally 80% band that covers 99% inflates safety stock; one that covers 60%
# starves it. Either way the planner is being lied to about how uncertain it is.
TARGET_COVERAGE = 80
COVERAGE_FLOOR = 70
COVERAGE_CEILING = 90


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

    # Conformalised quantile regression (Romano et al. 2019).
    #
    # The calibration slice is chronological, like the train/test split above: rows are
    # ordered by series, so slicing by position would have calibrated on a handful of
    # SKUs rather than on later dates.
    train_dates = np.array(sorted(tr.date.unique()))
    cal_from = pd.Timestamp(train_dates[max(1, int(len(train_dates) * .80))])
    qfit = tr[tr.date < cal_from]
    qcal = tr[tr.date >= cal_from]

    q10, q50, q90 = build_quantile(cols, .10), build_quantile(cols, .50), build_quantile(cols, .90)
    for q in (q10, q50, q90):
        q.fit(qfit[cols], qfit.demand)

    # The conformity score is how far outside its own band each calibration point fell.
    # Scoring the *quantile* models is the whole point: calibrating against the point
    # model's residuals instead adds a second, independent 80% spread on top of a band
    # that already spans 80%, which is what pushed coverage to 99%.
    y_cal = qcal.demand.to_numpy()
    scores = np.maximum(
        q10.predict(qcal[cols]) - y_cal,
        y_cal - q90.predict(qcal[cols]),
    )
    alpha = 0.20
    qlevel = min(1.0, (1 - alpha) * (len(scores) + 1) / max(len(scores), 1))
    # Negative when the raw quantiles are already too wide - this delta can tighten a
    # band, where a score built from absolute residuals could only ever widen one.
    conformal_delta = float(np.quantile(scores, qlevel)) if len(scores) else 0.0

    # p50 is the point model, not q50: the planner reads it as average daily demand,
    # and reg:quantileerror at alpha=0.5 predicts the median. Evaluate what ships.
    med = np.maximum(0, point.predict(te[cols]))
    lo = np.maximum(0, q10.predict(te[cols]) - conformal_delta)
    hi = q90.predict(te[cols]) + conformal_delta
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
    # The band is nominally 80%. It sat at 99% for a whole release because the number
    # was written to disk and never looked at, so record the verdict, not just the value.
    coverage = quantile_metrics["P10_P90_coverage_percent"]
    calibration_ok = bool(COVERAGE_FLOOR <= coverage <= COVERAGE_CEILING)

    meta = {
        "production_model": "XGBoost + Quantile XGBoost",
        "model_version": model_version,
        "data_source": source,
        "feature_columns": cols,
        "cutoff": str(cutoff_date.date()),
        "centre": "point model (expected demand, not the median)",
        "uncertainty_method": "direct quantile regression + conformal calibration",
        "quantiles": [0.10, 0.50, 0.90],
        "interval_method": "conformalized quantile regression (split CQR)",
        "conformal_delta": conformal_delta,
        "calibration_from": str(cal_from.date()),
        "calibration_ok": calibration_ok,
        "target_coverage_percent": TARGET_COVERAGE,
        "cv_folds": len(cv_metrics),
        "p10_p90_coverage_percent": coverage,
        "training_rows": int(len(tr)),
        "test_rows": int(len(te)),
        "unique_skus": int(clean.sku_id.nunique()),
        "unique_warehouses": int(clean.dc_id.nunique()),
    }
    (artifacts_dir / "model_metadata.json").write_text(json.dumps(meta, indent=2))
    result = {
        "training_rows": int(len(tr)),
        "test_rows": int(len(te)),
        "unique_skus": int(clean.sku_id.nunique()),
        "unique_warehouses": int(clean.dc_id.nunique()),
        "baseline_7_day_moving_average": baseline_metrics,
        "xgboost": point_metrics,
        "quantile_forecasting": quantile_metrics,
        "rolling_time_series_cv": cv_metrics,
        "selected_model_by_mae": "XGBoost",
        "calibration_ok": calibration_ok,
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
