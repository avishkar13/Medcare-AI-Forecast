"""Backtest the production forecast path and report whether it is calibrated.

Answers three questions the training metrics cannot, because training scores one step
ahead against true lags while production forecasts a whole horizon recursively:

  wMAPE     how far off the centre is
  bias      whether it is systematically high or low
  coverage  whether p10-p90 means what it says
  sigma     whether (p90-p10)/2.5631 - what the planner turns into safety stock -
            matches the forecast error it is supposed to describe

Usage:  python -m src.backtest [--horizon 14] [--windows 14,21,28]

Note the export is rate limited to 10 pulls an hour and each run costs one.
"""
from __future__ import annotations

import argparse
import json

import numpy as np
import pandas as pd

from src.config import BUNDLE_PATH, METADATA_PATH
from src.forecasting.recursive import forecast_series
from src.models.model import load_bundle
from src.project_adapter import canonicalize_training_data
from src.training_client import fetch_training_data

# z(0.9) - z(0.1). The same constant Node uses in utils/inventory.ts to turn a band
# into a standard deviation; the two must agree or safety stock is wrong.
P10_P90_SPREAD = 2.5631031

TARGET_COVERAGE = 80.0
SIGMA_TOLERANCE = 0.15


def evaluate(actual: np.ndarray, p10: np.ndarray, p50: np.ndarray, p90: np.ndarray) -> dict:
    total = actual.sum()
    implied_sigma = float(np.mean((p90 - p10) / P10_P90_SPREAD))
    true_sigma = float(np.std(actual - p50))
    return {
        "points": int(len(actual)),
        "wmape": float(100 * np.abs(actual - p50).sum() / total),
        "bias": float(100 * (p50 - actual).sum() / total),
        "coverage": float(100 * np.mean((actual >= p10) & (actual <= p90))),
        "implied_sigma": implied_sigma,
        "true_sigma": true_sigma,
        "sigma_ratio": implied_sigma / true_sigma if true_sigma else float("nan"),
    }


def run_window(canonical, keys, bundle, delta, back_days: int, horizon: int) -> dict:
    as_of = canonical.date.max() - pd.Timedelta(days=back_days)
    bands = forecast_series(canonical, keys, as_of, horizon, bundle, delta)
    actual = canonical[canonical.date > as_of].set_index(["sku_id", "dc_id", "date"]).demand

    rows = []
    for key, band in bands.items():
        for step in range(horizon):
            index = (key[0], key[1], as_of + pd.Timedelta(days=step + 1))
            if index in actual.index:
                rows.append((float(actual[index]), band.p10[step], band.p50[step], band.p90[step]))

    frame = np.array(rows)
    result = evaluate(frame[:, 0], frame[:, 1], frame[:, 2], frame[:, 3])
    result["as_of"] = str(as_of.date())
    result["back_days"] = back_days
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Backtest the recursive forecast path")
    parser.add_argument("--horizon", type=int, default=14)
    parser.add_argument("--windows", default="14,21,28", help="days back from the last date")
    parser.add_argument("--json", action="store_true", help="emit machine-readable output")
    arguments = parser.parse_args()

    canonical = canonicalize_training_data(fetch_training_data()[0])
    metadata = json.loads(METADATA_PATH.read_text()) if METADATA_PATH.exists() else {}
    delta = float(metadata.get("conformal_delta", 0.0))
    bundle = load_bundle(BUNDLE_PATH)
    keys = list(canonical.groupby(["sku_id", "dc_id"]).groups.keys())

    cutoff = metadata.get("cutoff")
    windows = [int(value) for value in arguments.windows.split(",")]
    results = [run_window(canonical, keys, bundle, delta, back, arguments.horizon) for back in windows]

    if arguments.json:
        print(json.dumps({"conformal_delta": delta, "windows": results}, indent=2))
        return

    print(f"model {metadata.get('model_version', '?')} | conformal_delta {delta:+.2f}"
          f" | train/test cutoff {cutoff} | horizon {arguments.horizon}d")
    print(f"{len(keys)} series, recursive - this is the production path, not one-step-ahead")
    print()
    print("  as_of        wMAPE      bias   coverage   implied s   true s   ratio")
    for row in results:
        # A window starting before the cutoff would be scoring the model on its own
        # training data, so say so rather than quietly reporting a flattering number.
        flag = "" if cutoff is None or row["as_of"] >= cutoff else "  <- IN SAMPLE"
        print("  %-10s %7.2f%%  %+7.2f%%  %7.1f%%  %9.2f %8.2f  %6.2f%s"
              % (row["as_of"], row["wmape"], row["bias"], row["coverage"],
                 row["implied_sigma"], row["true_sigma"], row["sigma_ratio"], flag))

    coverage = float(np.mean([row["coverage"] for row in results]))
    ratio = float(np.mean([row["sigma_ratio"] for row in results]))
    bias = float(np.mean([row["bias"] for row in results]))
    print()
    print("  mean coverage %.1f%% (target %.0f%%)   mean sigma ratio %.2f   mean bias %+.2f%%"
          % (coverage, TARGET_COVERAGE, ratio, bias))
    print()

    verdicts = [
        ("interval coverage", 70 <= coverage <= 90,
         "the band means what it says" ,
         "the band is mislabelled; safety stock is derived from it"),
        ("sigma for safety stock", abs(ratio - 1) <= SIGMA_TOLERANCE,
         "(p90-p10)/2.5631 matches the real error spread",
         "safety stock is off by roughly %+.0f%%" % (100 * (ratio - 1))),
    ]
    for name, ok, good, bad in verdicts:
        print(("  PASS  %-24s %s" if ok else "  FAIL  %-24s %s") % (name, good if ok else bad))


if __name__ == "__main__":
    main()
