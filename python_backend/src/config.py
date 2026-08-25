"""Engine configuration. Every value comes from the environment."""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS_DIR = ROOT / "artifacts"
OUTPUTS_DIR = ROOT / "outputs"
BUNDLE_PATH = ARTIFACTS_DIR / "forecast_pipeline.joblib"
METADATA_PATH = ARTIFACTS_DIR / "model_metadata.json"
METRICS_PATH = OUTPUTS_DIR / "model_metrics.json"


def _int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw)
    except ValueError as error:
        raise RuntimeError(f"{name} must be an integer, got {raw!r}") from error


def api_base_url() -> str:
    """Where /training-data lives, e.g. http://backend:4000/api.

    The engine has no database credentials by design: Prisma owns the schema, and a
    migration must not be able to silently break this service.
    """
    url = os.getenv("API_BASE_URL", "").strip().rstrip("/")
    if not url:
        raise RuntimeError(
            "API_BASE_URL is required. Point it at the Express API, "
            "e.g. http://backend:4000/api"
        )
    return url


MODEL_VERSION = os.getenv("MODEL_VERSION", "medcare-xgb-qrf-v1")
ENGINE_PORT = _int("ENGINE_PORT", 8000)
# Only ~180 days of history exist, so a longer horizon has no annual seasonality to
# learn from and would extrapolate a trend it cannot support.
MAX_HORIZON_DAYS = _int("ENGINE_MAX_HORIZON_DAYS", 180)
# /api/training-data is on the expensive tier: 10 requests per rolling hour. One pull
# per forecast request would exhaust it, so a pull is reused for this long.
TRAINING_CACHE_TTL_SECONDS = _int("TRAINING_CACHE_TTL_SECONDS", 900)
TRAINING_TIMEOUT_SECONDS = _int("TRAINING_TIMEOUT_SECONDS", 120)
# A series shorter than this cannot fill the 28-day lag features the model expects.
MIN_HISTORY_DAYS = _int("ENGINE_MIN_HISTORY_DAYS", 35)
