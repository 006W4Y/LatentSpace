"""Exact descriptive leave-one-out comparisons; no confidence or causal labels."""
from __future__ import annotations

import numpy as np
import pandas as pd

from .data import clean_json


def summary(series):
    values = series.dropna()
    if not len(values):
        return {"observed": 0, "missing": len(series), "mean": None, "median": None, "q1": None, "q3": None, "std": None}
    return clean_json({"observed": len(values), "missing": int(series.isna().sum()), "mean": values.mean(), "median": values.median(),
                       "q1": values.quantile(.25), "q3": values.quantile(.75), "std": values.std(ddof=1) if len(values)>1 else None})


def median_loo(series):
    observed = series.dropna().sort_values(kind="stable")
    values = observed.to_numpy(dtype=float)
    n = len(values)
    if n < 3:
        return {"available": False, "count": n, "metric": "Median", "largest_changes": []}
    k = n // 2
    positions = np.arange(n)
    if n % 2 == 0:
        without = np.where(positions < k, values[k], values[k-1])
    else:
        without = np.where(positions < k, (values[k]+values[k+1])/2,
                           np.where(positions==k, (values[k-1]+values[k+1])/2, (values[k-1]+values[k])/2))
    full = float(np.median(values))
    order = np.argsort(-np.abs(without-full), kind="stable")[:3]
    return clean_json({"available": True, "metric": "Median", "count": n, "full": full,
                       "minimum": without.min(), "maximum": without.max(), "undefined": 0,
                       "largest_changes": [{"row_id": int(observed.index[i]), "without": without[i], "difference": without[i]-full} for i in order if without[i] != full]})


def correlation_loo(frame, x, y):
    pair = frame[[x,y]].dropna()
    n = len(pair)
    if n < 4 or pair[x].nunique() < 2 or pair[y].nunique() < 2:
        return {"available": False, "count": n, "metric": "Pearson r", "columns": [x,y], "largest_changes": []}
    a, b = pair[x].to_numpy(dtype=float), pair[y].to_numpy(dtype=float)
    a, b = a-a.mean(), b-b.mean()
    xx, yy, xy = np.dot(a,a), np.dot(b,b), np.dot(a,b)
    denominator = np.sqrt(np.maximum(0,xx-a*a*n/(n-1))*np.maximum(0,yy-b*b*n/(n-1)))
    values = np.divide(xy-a*b*n/(n-1),denominator,out=np.full(n,np.nan),where=denominator>0)
    values = np.clip(values,-1,1)
    full = float(pair[x].corr(pair[y]))
    finite = np.flatnonzero(np.isfinite(values))
    if not len(finite):
        return {"available": False, "count": n, "metric": "Pearson r", "columns": [x,y], "undefined": n, "largest_changes": []}
    order = finite[np.argsort(-np.abs(values[finite]-full),kind="stable")[:3]]
    return clean_json({"available": True, "metric": "Pearson r", "columns": [x,y], "count": n, "full": full,
                       "minimum": values[finite].min(), "maximum": values[finite].max(), "undefined": n-len(finite),
                       "largest_changes": [{"row_id": int(pair.index[i]), "without": values[i], "difference": values[i]-full} for i in order if values[i] != full]})


def review_comparison(result, snapshot, column, exclude_rows):
    reference = snapshot["reference_ids"]
    excluded = exclude_rows or []
    if len(set(excluded)) != len(excluded) or not set(excluded).issubset(reference):
        raise ValueError("Auslassvergleiche benötigen eindeutige IDs aus der festen Referenzauswahl.")
    frame = result["_frame"].loc[reference]
    remaining = frame.drop(index=excluded)
    columns = snapshot["finding"]["columns"]
    numeric = [name for name in columns if result["roles"][name] == "number"]
    output = {"reference_rows": len(frame), "remaining_rows": len(remaining), "excluded_rows": excluded,
              "column": column, "column_comparison": None, "single_exclusion": [], "pair_comparison": None,
              "method": "Einzel-Auslassvergleich: jeweils genau eine beobachtete Zeile entfernen und dieselbe Kennzahl erneut berechnen. Der manuelle Vergleich verwendet die ausgewählten IDs; die Befundreferenz und Modellmarkierungen bleiben unverändert."}
    if result["roles"][column] == "number":
        output["column_comparison"] = {"before": summary(frame[column]), "after": summary(remaining[column])}
        output["single_exclusion"].append(median_loo(frame[column]))
    if len(numeric) >= 2:
        x,y = numeric[:2]
        full_pair, remaining_pair = frame[[x,y]].dropna(), remaining[[x,y]].dropna()
        def correlation(pair):
            return pair[x].corr(pair[y]) if len(pair)>=2 and pair[x].nunique()>1 and pair[y].nunique()>1 else None
        output["pair_comparison"] = {"columns": [x,y], "before": correlation(full_pair), "after": correlation(remaining_pair), "before_n": len(full_pair), "after_n": len(remaining_pair)}
        output["single_exclusion"].append(correlation_loo(frame,x,y))
    return clean_json(output)
