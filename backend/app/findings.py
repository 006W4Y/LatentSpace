"""Frozen finding references and investigations, independent of later filters/model flags."""
from __future__ import annotations

from collections import OrderedDict
import copy
import hashlib
import json

import numpy as np
import pandas as pd

from .data import clean_json
from .explanations import format_number
from .observations import describe_findings
from .sensitivity import review_comparison
from .presentation import number_series
from .labels import MONTHS


def fingerprint(result):
    if "_fingerprint" not in result:
        result["_fingerprint"] = hashlib.sha256(json.dumps([row["values"] for row in result["rows"]], ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    return result["_fingerprint"]


def bind_findings(result, subset, findings, filters):
    registry = result.setdefault("_findings", OrderedDict())
    reference_ids = sorted(subset.index.tolist())
    scope = hashlib.sha256(json.dumps([result["dataset_id"], reference_ids]).encode()).hexdigest()[:20]
    bound = []
    model_flags = [i for i in reference_ids if result["rows"][i]["anomaly"]]
    for source in findings:
        finding = copy.deepcopy(source)
        finding["reference"] = {"id": scope, "count": len(reference_ids), "label": "Auswahl beim Finden"}
        if not finding["row_ids"]:
            finding["row_ids"] = ([i for i in reference_ids if result["rows"][i]["anomaly"]] if finding["id"] == "model:anomalies" else reference_ids)
        token = hashlib.sha256(json.dumps([fingerprint(result), result["config"], finding], sort_keys=True, ensure_ascii=False, allow_nan=False).encode()).hexdigest()[:32]
        finding["token"] = token
        snapshot = {"finding": finding, "reference_ids": reference_ids, "filters": filters,
                    "dataset_id": result["dataset_id"], "fingerprint": fingerprint(result),
                    "analysis_config": {**result["config"], "roles": result["roles"]}, "versions": result["versions"], "seed": result["seed"],
                    "model_flags": model_flags, "schema_version": 2, "app_version": "0.4.0", "decimal": result.get("_decimal", ".")}
        registry[token] = snapshot
        registry.move_to_end(token)
        while len(registry) > 512:
            registry.popitem(last=False)
        bound.append(finding)
    return bound


def require_finding(result, token):
    snapshot = result.get("_findings", {}).get(token)
    if snapshot is None:
        raise KeyError("Dieser Befund ist nicht mehr im Analysespeicher. Bitte die Insight-Ansicht aktualisieren oder einen gespeicherten Befund öffnen.")
    return snapshot


def investigate(result, snapshot, mode="affected", page=0, column=None, exclude_rows=None):
    if mode not in {"affected", "comparison", "reference"} or page < 0 or page > 400:
        raise ValueError("Ungültige Vergleichsauswahl oder Seite.")
    if "basis" not in snapshot["finding"]:
        snapshot = copy.deepcopy(snapshot)
        legacy = snapshot["finding"]
        legacy.pop("priority", None)
        describe_findings(result, result["_frame"].loc[snapshot["reference_ids"]], [legacy], snapshot["filters"])
        legacy["title"] = f"Gespeicherter Befund: {legacy['procedure']}"
        legacy["detail"] = "; ".join(f"{entry['label']}: {entry['value']}" for entry in legacy["evidence"])
        legacy["limitation"] = "Gespeicherte Berechnung aus einer früheren Version; die damalige Referenz und Regel sind unverändert."
    finding = snapshot["finding"]
    frame = result["_frame"]
    reference_ids = snapshot["reference_ids"]
    affected_ids = sorted(set(finding["row_ids"]) & set(reference_ids))
    affected_set = set(affected_ids)
    columns = finding["columns"] or list(frame.columns)
    column = column or columns[0]
    if column not in frame.columns:
        raise ValueError("Unbekannte Vergleichsspalte.")
    comparison_ids = [i for i in reference_ids if i not in affected_set]
    if any(rule["kind"] == "iqr" and rule["column"] == column for rule in finding["cell_evidence"]):
        comparison_ids = [i for i in comparison_ids if pd.notna(frame.at[i, column])]
    row_ids = {"affected": affected_ids, "comparison": comparison_ids, "reference": reference_ids}[mode]
    rules = {rule["column"]: rule for rule in finding["cell_evidence"]}
    rows = [{"id": i, "values": result["rows"][i]["values"], "anomaly": result["rows"][i]["anomaly"],
             "finding_evidence": rules if i in affected_set else {}} for i in row_ids[page*50:(page+1)*50]]
    cohorts = [("Referenz beim Finden", reference_ids), ("Befundzeilen", affected_ids), ("Übrige Referenzzeilen", comparison_ids)]
    summaries = []
    for label, ids in cohorts:
        source = frame.loc[ids, column]
        numeric = result["roles"][column] == "number"
        summaries.append({"label": label, "count": len(ids), "missing": int(source.isna().sum()),
                          "median": source.median() if numeric and source.notna().any() else None, "mean": source.mean() if numeric and source.notna().any() else None})
    reference = frame.loc[reference_ids, column]
    display = snapshot["analysis_config"].get("display", {}).get(column, {})
    distribution = []
    if display.get("month_base", "none") != "none":
        offset = 0 if display["month_base"] == "zero" else 1
        numeric = number_series(reference, snapshot.get("decimal", ".")).dropna()
        for code in sorted(numeric.unique()):
            distribution.append({"label": MONTHS[int(code) - offset], **{key: int(number_series(frame.loc[ids,column], snapshot.get("decimal", ".")).eq(code).sum()) for key, (_,ids) in zip(["reference","affected","comparison"],cohorts)}})
    elif result["roles"][column] == "number" and reference.notna().any():
        values = reference.dropna()
        edges = np.histogram_bin_edges(values, bins=min(12, max(1, values.nunique())))
        for i in range(len(edges) - 1):
            bucket = {"label": f"{format_number(edges[i])} – {format_number(edges[i+1])}"}
            for key, (_, ids) in zip(["reference", "affected", "comparison"], cohorts):
                bucket[key] = int(np.histogram(frame.loc[ids, column].dropna(), bins=edges)[0][i])
            distribution.append(bucket)
    elif result["roles"][column] != "number":
        labels = reference.dropna().astype(str).value_counts().head(10).index.tolist()
        for label in labels:
            distribution.append({"label": label, **{key: int(frame.loc[ids, column].dropna().astype(str).eq(label).sum()) for key, (_, ids) in zip(["reference", "affected", "comparison"], cohorts)}})
        remainder = {key: int((~frame.loc[ids, column].dropna().astype(str).isin(labels)).sum()) for key, (_, ids) in zip(["reference", "affected", "comparison"], cohorts)}
        if any(remainder.values()):
            distribution.append({"label": "Übrige Kategorien (zusammengefasst)", **remainder})
    missing = {key: int(frame.loc[ids, column].isna().sum()) for key, (_, ids) in zip(["reference", "affected", "comparison"], cohorts)}
    if any(missing.values()):
        distribution.append({"label": "Fehlende Werte", **missing})
    numeric_columns = [name for name in columns if result["roles"][name] == "number"]
    scatter, scatter_total = [], 0
    if len(numeric_columns) >= 2:
        x, y = numeric_columns[:2]
        pairs = frame.loc[reference_ids].dropna(subset=[x, y])
        scatter_total = len(pairs)
        sampled = pairs.index[np.linspace(0, len(pairs) - 1, min(1400, len(pairs)), dtype=int)].tolist() if len(pairs) else []
        sampled = sorted(set(sampled + [i for i in affected_ids if i in pairs.index][:100]))
        group = next((name for name in columns if result["roles"][name] == "category"), None)
        scatter = [{"x": frame.at[i, x], "y": frame.at[i, y], "row_id": i, "affected": i in affected_set,
                    "group": str(frame.at[i, group]) if group else "Alle"} for i in sampled]
    return clean_json({"finding": finding, "mode": mode, "page": page, "count": len(row_ids), "rows": rows,
                       "column": column, "columns": columns, "all_columns": list(frame.columns), "role": result["roles"][column],
                       "reference_row_ids": reference_ids, "reference_count": len(reference_ids), "affected_count": len(affected_ids), "comparison_count": len(comparison_ids), "excluded_comparison_count": len(reference_ids) - len(affected_ids) - len(comparison_ids),
                       "summaries": summaries, "distribution": distribution, "comparison_groups": finding["comparison_groups"],
                       "scatter": scatter, "scatter_total": scatter_total, "scatter_columns": numeric_columns[:2],
                       "analysis_config": snapshot["analysis_config"], "source_filters": snapshot["filters"], "fingerprint": snapshot["fingerprint"], "display": display, "review": review_comparison(result, snapshot, column, exclude_rows or [])})


def finding_report(result, snapshot, notes="", review=None):
    detail = investigate(result, snapshot, column=(review or {}).get("column"), exclude_rows=(review or {}).get("exclude_rows", []))
    ids = snapshot["finding"]["row_ids"]
    return clean_json({"report_version": "3.0", "finding": detail["finding"],
                       "reference_row_ids": snapshot["reference_ids"], "source_filters": snapshot["filters"],
                       "fingerprint_sha256": snapshot["fingerprint"], "analysis_config": snapshot["analysis_config"],
                       "versions": snapshot["versions"], "seed": snapshot["seed"], "notes": notes, "notes_origin": "user", "review": detail["review"], "app_version": snapshot.get("app_version", "0.3.0"),
                       "rows": [{"source_row": i + 1, "row_id": i, "values": result["rows"][i]["values"]} for i in ids],
                       "limitation": "Die Referenz umfasst exakt die aufgeführten 0-basierten IDs. source_row ist 1-basiert. Originalwerte sind unverändert; statistische Zellbelege sind keine Modellattribution."})
