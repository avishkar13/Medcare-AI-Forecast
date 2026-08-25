"""Shared forecasting utilities for the project-compatible service."""
from src.models.model import load_bundle


def model_drivers(bundle, cols=None):
    """Return top global XGBoost feature importances for API explainability."""
    try:
        pre = bundle["point"].named_steps["preprocessor"]
        model = bundle["point"].named_steps["model"]
        names = pre.get_feature_names_out()
        gains = model.feature_importances_
        pairs = sorted(zip(names, gains), key=lambda z: z[1], reverse=True)
        total = sum(float(g) for _, g in pairs) or 1.0
        return [
            {"feature": str(name).split("__", 1)[-1], "relative_importance": round(float(g) / total, 4)}
            for name, g in pairs[:5]
        ]
    except Exception:
        return []
