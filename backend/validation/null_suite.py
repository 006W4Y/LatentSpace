"""Reproducible descriptive rule-match audit on independent random samples.

Run: python -m backend.validation.null_suite > docs/null-simulation.json
No fitted model is included. A rule match is not labeled true/false or significant.
"""
from collections import Counter
import json

import numpy as np
import pandas as pd

from backend.app.insights import build_profile, discover

DISTRIBUTIONS = ("normal", "uniform", "lognormal", "student_t3", "poisson")


def null_frame(distribution, seed, n=240):
    rng = np.random.default_rng(np.random.SeedSequence([20261024, DISTRIBUTIONS.index(distribution), seed]))
    generators = {"normal": lambda: rng.normal(size=n), "uniform": lambda: rng.uniform(-1, 1, n),
                  "lognormal": lambda: rng.lognormal(size=n), "student_t3": lambda: rng.standard_t(3, n),
                  "poisson": lambda: rng.poisson(3, n).astype(float)}
    frame = pd.DataFrame({f"M{i}": generators[distribution]() for i in range(3)})
    frame["Gruppe"] = rng.choice(["A", "B", "C"], n)
    frame["Datum"] = pd.to_datetime("2026-01-01", utc=True) + pd.to_timedelta(rng.integers(0, 181, n), unit="D")
    frame.loc[rng.random(n) < .1, "M0"] = np.nan
    return frame


def search(frame):
    roles = {name: "number" for name in ["M0", "M1", "M2"]} | {"Gruppe": "category", "Datum": "date"}
    correlations = []
    for i, x in enumerate(["M0", "M1", "M2"]):
        for y in ["M0", "M1", "M2"][i+1:]:
            pair = frame[[x,y]].dropna()
            if pair[x].nunique()>1 and pair[y].nunique()>1:
                correlations.append({"x":x,"y":y,"value":pair[x].corr(pair[y]),"spearman":pair[x].corr(pair[y],method="spearman"),"count":len(pair)})
    return discover({"roles":roles,"numeric_columns":["M0","M1","M2"]},frame,
                    [build_profile(name,role,frame[name]) for name,role in roles.items()],correlations,0)


def audit(seeds=30):
    results = {}
    for distribution in DISTRIBUTIONS:
        counts, samples = Counter(), Counter()
        for seed in range(seeds):
            found = Counter(item["id"].split(":")[0] for item in search(null_frame(distribution,seed)))
            counts.update(found)
            samples.update(found.keys())
        results[distribution] = {"datasets":seeds,"rule_matches":dict(sorted(counts.items())),"datasets_with_match":dict(sorted(samples.items()))}
    return {"app_version":"0.4.0","versions":{"numpy":np.__version__,"pandas":pd.__version__},"datasets":seeds*len(DISTRIBUTIONS),"rows_per_dataset":240,"seeds":list(range(seeds)),"seed_mapping":"NumPy SeedSequence([20261024, distribution_index, seed]); distinct random stream for every distribution and replicate",
            "design":"Three independent numerical columns; independent category, calendar day and 10% MCAR in M0. Identical search rules, no Isolation Forest/HDBSCAN or projection.",
            "interpretation":"Descriptive search matches on random controls. Counts are not a calibrated false-positive rate, significance test or domain-error probability. Quartile and monthly differences can occur in random data.","results":results}


if __name__ == "__main__":
    print(json.dumps(audit(),ensure_ascii=False,indent=2,allow_nan=False))
