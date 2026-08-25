
import numpy as np
import pandas as pd

def detect_demand_anomaly(history):
    x=history.sort_values("date").copy()
    s=x["demand"].astype(float)
    baseline=s.shift(1).rolling(28,min_periods=14).median()
    mad=(s.shift(1)-baseline).abs().rolling(28,min_periods=14).median()
    robust_z=(s-baseline)/(1.4826*mad.replace(0,np.nan))
    latest=float(robust_z.iloc[-1]) if pd.notna(robust_z.iloc[-1]) else 0.0
    if latest>=3: level="CRITICAL"
    elif latest>=2: level="HIGH"
    elif latest>=1.5: level="MEDIUM"
    else: level="NORMAL"
    return {"robust_z":round(latest,3),"level":level}

