"""Fit the engine on the Express training-data export.

Training and inference read the same endpoint, so the features a model is fitted on
are the features it later predicts against.
"""
from __future__ import annotations

import argparse
import json

from src.config import ARTIFACTS_DIR, MODEL_VERSION, OUTPUTS_DIR
from src.project_adapter import canonicalize_training_data
from src.training_client import fetch_training_data
from src.training_core import train_dataframe


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model-version", default=MODEL_VERSION)
    arguments = parser.parse_args()

    raw, _future_promotions = fetch_training_data(force=True)
    canonical = canonicalize_training_data(raw)
    print(
        f"pulled {len(raw)} rows, "
        f"{canonical.sku_id.nunique()} SKUs x {canonical.dc_id.nunique()} DCs, "
        f"{canonical.date.min().date()} -> {canonical.date.max().date()}"
    )

    result = train_dataframe(
        canonical,
        ARTIFACTS_DIR,
        OUTPUTS_DIR,
        "express:/api/training-data",
        arguments.model_version,
    )
    print(json.dumps(result, indent=2))

    if not result.get("calibration_ok", True):
        coverage = result["quantile_forecasting"]["P10_P90_coverage_percent"]
        print()
        print("!" * 78)
        print(f"  CALIBRATION OFF: p10-p90 covers {coverage:.1f}% of actuals, target 80%.")
        print("  The planner derives safety stock from this band, so it is now wrong")
        print("  in whichever direction the number is off. Do not ship this model.")
        print("!" * 78)


if __name__ == "__main__":
    main()
