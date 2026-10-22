"""Analysis in feature space; projections are used only for display."""
from __future__ import annotations

import importlib.metadata
import warnings

import numpy as np
import pandas as pd
from pydantic import BaseModel, Field
from sklearn.cluster import HDBSCAN
from sklearn.decomposition import PCA
from sklearn.ensemble import IsolationForest
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from threadpoolctl import threadpool_limits

from .data import ROLES, clean_json, date_series, number_series
from .explanations import explain_row
from .insights import build_profile, discover


class AnalysisRequest(BaseModel):
    roles: dict[str, str] = Field(default_factory=dict)
    features: list[str] = Field(default_factory=list, max_length=40)
    projection: str = "pca"
    min_cluster_size: int = Field(default=20, ge=3, le=1000)


class ExploreRequest(BaseModel):
    query: str = Field(default="", max_length=200)
    category_column: str | None = None
    category_value: str | None = None
    anomalies_only: bool = False
    cluster: int | None = None
    row_ids: list[int] | None = Field(default=None, max_length=20000)
    date_column: str | None = None
    value_column: str | None = None
    group_column: str | None = None
    period: str = "month"
    aggregation: str = "mean"
    page: int = Field(default=0, ge=0, le=20000)
    explain_page: bool = False
    duplicate_keys: list[str] = Field(default_factory=list, max_length=8)


def prepare(payload: dict, request: AnalysisRequest):
    frame = pd.DataFrame(payload["rows"])
    roles = {column["name"]: column["role"] for column in payload["columns"]}
    for name, role in request.roles.items():
        if name not in roles or role not in ROLES:
            raise ValueError("Unbekannte Spalte oder ungültige Spaltenrolle.")
        roles[name] = role
    for name, role in roles.items():
        if role == "number":
            frame[name] = number_series(frame[name], payload["decimal"])
        elif role == "date":
            frame[name] = date_series(frame[name])
    features = request.features or [name for name, role in roles.items() if role == "number"][:40]
    if len(features) != len(set(features)) or any(name not in roles or roles[name] != "number" for name in features):
        raise ValueError("Analysemerkmale müssen eindeutige numerische Spalten sein.")
    if request.projection not in {"pca", "umap"}:
        raise ValueError("Bitte PCA oder UMAP als Projektion auswählen.")
    usable = [name for name in features if frame[name].notna().any() and frame[name].nunique() > 1]
    return frame, roles, features, usable


def analyze(payload: dict, request: AnalysisRequest) -> dict:
    frame, roles, features, usable = prepare(payload, request)
    n = len(frame)
    notices = list(payload["notices"])
    for name in features:
        if name not in usable:
            notices.append(f"{name}: konstant oder vollständig leer; für die Modellanalyse ausgelassen.")
    imputed = int(frame[usable].isna().sum().sum()) if usable else 0
    if imputed:
        notices.append(f"Für die Modellanalyse wurden {imputed} fehlende Werte durch den Spaltenmedian ersetzt. Originaldaten und Statistiken bleiben unverändert.")
    coords = np.zeros((n, 3))
    clusters = np.full(n, -1)
    anomaly = np.zeros(n, dtype=bool)
    scores = np.zeros(n)
    explained = None
    actual_projection = request.projection
    matrix = None
    with threadpool_limits(limits=2):
        if usable and n >= 3:
            matrix = StandardScaler().fit_transform(SimpleImputer(strategy="median").fit_transform(frame[usable]))
            # Clustering and anomaly detection use standardized features, never display coordinates.
            model = IsolationForest(n_estimators=100, contamination="auto", random_state=42, n_jobs=1)
            anomaly = model.fit_predict(matrix) == -1
            scores = -model.score_samples(matrix)
            if n >= request.min_cluster_size:
                clusters = HDBSCAN(min_cluster_size=request.min_cluster_size, min_samples=min(10, request.min_cluster_size), n_jobs=1, copy=True).fit_predict(matrix)
            dimension = min(3, len(usable), n)
            if request.projection == "umap" and n >= 6:
                from umap import UMAP
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore", UserWarning)
                    embedded = UMAP(n_components=dimension, n_neighbors=min(15, n - 1), random_state=42, n_jobs=1, init="random").fit_transform(matrix)
            else:
                if request.projection == "umap":
                    actual_projection = "pca"
                    notices.append("Für weniger als sechs Zeilen wurde PCA statt UMAP verwendet.")
                pca = PCA(n_components=dimension, random_state=42)
                embedded = pca.fit_transform(matrix)
                explained = clean_json(pca.explained_variance_ratio_.tolist())
            coords[:, :dimension] = embedded
        else:
            actual_projection = "none"
            notices.append("Für Cluster, Anomalien und Landschaft sind mindestens drei Zeilen und ein veränderliches numerisches Merkmal nötig.")
    numeric = [name for name, role in roles.items() if role == "number"]
    converted_missing = {name: int(frame[name].isna().sum()) for name in frame.columns}
    conversion_failures = {name: converted_missing[name] - next(c["missing"] for c in payload["columns"] if c["name"] == name) for name in frame.columns}
    for name, count in conversion_failures.items():
        if count > 0:
            notices.append(f"{name}: {count} Werte konnten mit der gewählten Rolle nicht gelesen werden und gelten in Analysen als fehlend.")
    versions = {name: importlib.metadata.version(name) for name in ["numpy", "pandas", "scikit-learn", "umap-learn"]}
    return {
        "dataset_id": payload["id"], "name": payload["name"], "roles": roles, "features": usable,
        "config": request.model_dump(), "seed": 42, "versions": versions,
        "projection": actual_projection, "explained_variance": explained,
        "notices": notices, "numeric_columns": numeric,
        "cluster_count": len(set(clusters.tolist()) - {-1}), "anomaly_count": int(anomaly.sum()),
        "rows": clean_json([{"id": i, "values": payload["rows"][i], "coords": coords[i].tolist(), "cluster": int(clusters[i]), "anomaly": bool(anomaly[i]), "score": float(scores[i])} for i in range(n)]),
        "_frame": frame, "_matrix": matrix,
    }


def public_analysis(result: dict) -> dict:
    return {key: value for key, value in result.items() if not key.startswith("_")}


def explore(result: dict, request: ExploreRequest) -> dict:
    frame = result["_frame"]
    roles = result["roles"]
    for name in [request.category_column, request.date_column, request.value_column, request.group_column]:
        if name is not None and name not in roles:
            raise ValueError("Die gewählte Spalte existiert nicht.")
    if request.date_column and roles[request.date_column] != "date":
        raise ValueError("Für die Zeitachse ist eine Datumsspalte nötig.")
    if request.value_column and roles[request.value_column] != "number":
        raise ValueError("Bitte einen numerischen Messwert auswählen.")
    if request.period not in {"day", "week", "month"} or request.aggregation not in {"sum", "mean", "median", "count"}:
        raise ValueError("Ungültige Zeitauflösung oder Aggregation.")
    if len(set(request.duplicate_keys)) != len(request.duplicate_keys) or any(name not in roles for name in request.duplicate_keys):
        raise ValueError("Duplikatschlüssel müssen eindeutige vorhandene Spalten sein.")
    mask = pd.Series(True, index=frame.index)
    if request.query:
        mask &= frame.astype("string").apply(lambda col: col.str.contains(request.query, case=False, regex=False, na=False)).any(axis=1)
    if request.category_column and request.category_value is not None:
        source = frame[request.category_column]
        if pd.api.types.is_bool_dtype(source):
            mask &= source.astype("string").str.lower().eq(request.category_value.lower()).fillna(False)
        elif pd.api.types.is_numeric_dtype(source):
            # Browser JSON represents 1.0 as 1; numeric category filters must match both.
            target = pd.to_numeric(pd.Series([request.category_value]), errors="coerce").iloc[0]
            mask &= source.eq(target).fillna(False)
        else:
            mask &= source.astype("string").eq(request.category_value).fillna(False)
    if request.anomalies_only:
        mask &= pd.Series([row["anomaly"] for row in result["rows"]], index=frame.index)
    if request.cluster is not None:
        mask &= pd.Series([row["cluster"] == request.cluster for row in result["rows"]], index=frame.index)
    if request.row_ids is not None:
        mask &= frame.index.isin(request.row_ids)
    subset = frame.loc[mask]
    ids = subset.index.tolist()
    numeric = sorted(result["numeric_columns"])
    profiles = [build_profile(name, roles[name], subset[name]) for name in frame.columns]
    correlations = []
    if len(subset) >= 3:
        corr = subset[numeric].corr(method="pearson")
        rank_corr = subset[numeric].corr(method="spearman")
        for i, name in enumerate(numeric):
            for other in numeric[i+1:]:
                count = int(subset[[name, other]].dropna().shape[0])
                value = corr.loc[name, other]
                if pd.notna(value):
                    correlations.append({"x": name, "y": other, "value": float(value), "spearman": rank_corr.loc[name, other], "count": count})
    correlations.sort(key=lambda item: abs(item["value"]), reverse=True)
    trend = []
    skipped_dates = 0
    if request.date_column:
        dates = subset[request.date_column]
        skipped_dates = int(dates.isna().sum())
        dated = subset.loc[dates.notna()].copy()
        if len(dated):
            freq = {"day": "D", "week": "W-MON", "month": "MS"}[request.period]
            grouper = pd.Grouper(key=request.date_column, freq=freq)
            if request.aggregation == "count":
                values = dated.groupby(grouper).size()
            elif request.value_column:
                grouped = dated.groupby(grouper)[request.value_column]
                values = grouped.sum(min_count=1) if request.aggregation == "sum" else grouped.median() if request.aggregation == "median" else grouped.mean()
            else:
                values = pd.Series(dtype=float)
            trend = [{"date": key.strftime("%Y-%m-%d"), "value": value} for key, value in values.items()]
    groups = []
    if request.group_column:
        grouped = subset.groupby(request.group_column, dropna=False)
        for key, part in grouped:
            value = None
            if request.value_column:
                source = part[request.value_column]
                value = source.mean() if request.aggregation == "mean" else source.median() if request.aggregation == "median" else source.sum(min_count=1)
            groups.append({"label": str(key) if pd.notna(key) else "(fehlend)", "count": len(part), "value": len(part) if request.aggregation == "count" else value})
        groups.sort(key=lambda item: item["count"], reverse=True)
    cluster_profiles = []
    for cluster in sorted(set(result["rows"][i]["cluster"] for i in ids)):
        members = [i for i in ids if result["rows"][i]["cluster"] == cluster]
        differences = []
        for name in result["features"]:
            std = frame[name].std()
            delta = (frame.loc[members, name].mean() - frame[name].mean()) / std if std and pd.notna(std) else 0
            if pd.notna(delta):
                differences.append({"feature": name, "delta": float(delta), "mean": frame.loc[members, name].mean(), "baseline": frame[name].mean()})
        differences.sort(key=lambda item: abs(item["delta"]), reverse=True)
        cluster_profiles.append({"cluster": cluster, "count": len(members), "differences": differences[:3]})
    anomalies = sorted((result["rows"][i] for i in ids if result["rows"][i]["anomaly"]), key=lambda row: row["score"], reverse=True)
    missing = int(subset.isna().sum().sum())
    coverage = {}
    insights = discover(result, subset, profiles, correlations, len(anomalies), request.duplicate_keys, coverage)
    complete_keys = subset.dropna(subset=request.duplicate_keys) if request.duplicate_keys else subset.iloc[:0]
    coverage["duplicate_check"] = {"keys": request.duplicate_keys, "complete": len(complete_keys), "duplicate_rows": int(complete_keys.duplicated(subset=request.duplicate_keys, keep=False).sum()) if request.duplicate_keys else 0, "skipped": len(subset) - len(complete_keys) if request.duplicate_keys else 0}
    from .findings import bind_findings
    insights = bind_findings(result, subset, insights, request.model_dump())
    explained_anomalies = [{**row, "explanation": explain_row(result, row["id"])} for row in anomalies[:30]]
    page_rows = [result["rows"][i] for i in ids[request.page*50:(request.page+1)*50]]
    if request.explain_page:
        page_rows = [{**row, "explanation": explain_row(result, row["id"])} if row["anomaly"] else row for row in page_rows]
    return clean_json({
        "count": len(subset), "total": len(frame), "filtered_ids": ids,
        "missing": missing, "duplicates": int(subset.astype("string").duplicated().sum()),
        "profiles": profiles, "correlations": correlations, "trend": trend, "groups": groups[:30], "group_total": len(groups),
        "skipped_dates": skipped_dates, "clusters": cluster_profiles, "anomalies": explained_anomalies, "anomaly_count": len(anomalies),
        "insights": insights, "coverage": coverage, "rows": page_rows,
        "page": request.page,
    })
