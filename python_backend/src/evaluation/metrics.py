
import numpy as np

def metrics(y,p):
    y=np.asarray(y,dtype=float); p=np.asarray(p,dtype=float)
    err=p-y
    return {
        "MAE":float(np.mean(np.abs(err))),
        "RMSE":float(np.sqrt(np.mean(err**2))),
        "MAPE_percent":float(np.mean(np.abs(err)/np.maximum(np.abs(y),1e-8))*100),
        "sMAPE_percent":float(np.mean(2*np.abs(err)/(np.abs(y)+np.abs(p)+1e-8))*100),
        "wMAPE_percent":float(np.sum(np.abs(err))/max(np.sum(np.abs(y)),1e-8)*100),
        "bias_percent":float(np.sum(err)/max(np.sum(np.abs(y)),1e-8)*100)
    }

def pinball_loss(y,q,alpha):
    y=np.asarray(y,dtype=float); q=np.asarray(q,dtype=float)
    e=y-q
    return float(np.mean(np.maximum(alpha*e,(alpha-1)*e)))

def interval_coverage(y,lo,hi):
    y=np.asarray(y); lo=np.asarray(lo); hi=np.asarray(hi)
    return float(np.mean((y>=lo)&(y<=hi)))

def interval_width(lo,hi):
    return float(np.mean(np.asarray(hi)-np.asarray(lo)))
