
import joblib
from xgboost import XGBRegressor
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.pipeline import Pipeline

def _preprocessor(cols):
    cat=["sku_id","dc_id"]
    num=[c for c in cols if c not in cat]
    return ColumnTransformer(
        [("cat",OneHotEncoder(handle_unknown="ignore"),cat),
         ("num","passthrough",num)],
        remainder="drop"
    )

def build_point(cols):
    model=XGBRegressor(
        n_estimators=500,max_depth=7,learning_rate=.035,
        subsample=.85,colsample_bytree=.85,min_child_weight=3,
        reg_alpha=.05,reg_lambda=1.2,objective="reg:squarederror",
        random_state=42,n_jobs=2
    )
    return Pipeline([("preprocessor",_preprocessor(cols)),("model",model)])

def build_quantile(cols, alpha):
    model=XGBRegressor(
        n_estimators=400,max_depth=7,learning_rate=.035,
        subsample=.85,colsample_bytree=.85,min_child_weight=3,
        reg_alpha=.05,reg_lambda=1.2,
        objective="reg:quantileerror",quantile_alpha=float(alpha),
        random_state=42,n_jobs=2
    )
    return Pipeline([("preprocessor",_preprocessor(cols)),("model",model)])

def save_bundle(bundle,path):
    joblib.dump(bundle,path)

def load_bundle(path):
    return joblib.load(path)
