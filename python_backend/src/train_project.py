"""Train the ML engine from the actual MedCare PostgreSQL/Prisma database."""
import argparse
import os
from pathlib import Path
from src.data_project import load_all_history
from src.project_adapter import canonicalize_project_history
from src.training_core import train_dataframe

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "artifacts"
OUT = ROOT / "outputs"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model-version", default=os.getenv("MODEL_VERSION", "medcare-xgb-qrf-v1"))
    args = ap.parse_args()
    raw = load_all_history()
    canonical = canonicalize_project_history(raw)
    result = train_dataframe(canonical, ART, OUT, "medcare-postgresql", args.model_version)
    import json
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
