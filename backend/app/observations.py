"""Descriptive provenance, result classes, and user-selected measurement ordering."""
from __future__ import annotations

from collections import Counter
import math

import pandas as pd

from .data import clean_json


PROCEDURES = {
    "missing": ("observation", "Anzahl ohne lesbaren Wert"),
    "constant": ("observation", "Anzahl verschiedener Werte"),
    "key_duplicates": ("observation", "Wiederholte gewählte Wertkombination"),
    "concentration": ("rule", "Kategorieanteil mit Suchschwelle"),
    "range": ("rule", "Quartilsregel"),
    "correlation": ("rule", "Pearson-/Spearman-Vergleich mit Suchschwelle"),
    "difference": ("rule", "Gruppenmediane mit Suchschwelle"),
    "time": ("rule", "Benachbarte Monatsmittel mit Suchschwelle"),
    "missing_pattern": ("rule", "Anteile ohne Wert nach Gruppe und Zeitraum"),
    "redundancy": ("rule", "Relative Reststreuung einer linearen Anpassung"),
    "sensitivity": ("rule", "Korrelationsvergleich nach Auslassen dreier Zeilen"),
    "within_groups": ("rule", "Gruppenweise Pearson-Korrelation mit Suchschwelle"),
    "rare_combination": ("rule", "Häufigkeit gegenüber Unabhängigkeitsreferenz"),
    "model": ("model", "Isolation Forest · contamination=auto"),
}


def filter_labels(filters):
    labels = []
    if filters.get("query"):
        labels.append(f"Textsuche enthält: {filters['query']}")
    if filters.get("category_column") and filters.get("category_value") is not None:
        labels.append(f"{filters['category_column']} = {filters['category_value']}")
    if filters.get("anomalies_only"):
        labels.append("Nur Isolation-Forest-Markierungen")
    if filters.get("cluster") is not None:
        labels.append(f"HDBSCAN-Zuordnung = {filters['cluster']}")
    if filters.get("row_ids") is not None:
        labels.append(f"Explizite Zeilenauswahl: {len(set(filters['row_ids']))} IDs")
    return labels or ["Keine Zeilenfilter"]


def describe_findings(result, subset, findings, filters):
    roles = result["roles"]
    display = result.get("config", {}).get("display", {})
    n = len(subset)
    stats = {}
    for name in set(column for finding in findings for column in finding["columns"]) | set(result.get("features", [])):
        values = subset[name]
        raw_missing = sum(result["rows"][int(i)]["values"].get(name) is None for i in subset.index)
        missing = int(values.isna().sum())
        stats[name] = {"name": name, "role": roles[name], "observed": n - missing,
                       "missing": missing, "source_missing": raw_missing, "conversion_missing": max(0, missing - raw_missing),
                       "display": display.get(name, {})}
    for finding in findings:
        finding.pop("priority", None)
        family = finding["id"].split(":", 1)[0]
        origin, procedure = PROCEDURES.get(family, ("observation", finding["method"]))
        columns = finding["columns"] or (result.get("features", []) if origin == "model" else [])
        finding["columns"] = columns
        complete = int(subset[columns].notna().all(axis=1).sum()) if columns else n
        column_basis = [stats.get(name) or {"name": name, "role": roles[name], "observed": int(subset[name].notna().sum()), "missing": int(subset[name].isna().sum()), "source_missing": sum(result["rows"][int(i)]["values"].get(name) is None for i in subset.index), "conversion_missing": 0, "display": display.get(name, {})} for name in columns]
        finding["result_type"] = origin
        finding["procedure"] = procedure
        finding["basis"] = {"label": "Auswahl beim Finden", "reference_rows": n, "dataset_rows": len(result["rows"]),
                            "complete_rows": complete, "missing_cells": sum(column["missing"] for column in column_basis),
                            "columns": column_basis, "filters": filter_labels(filters),
                            "model_training_rows": len(result["rows"]) if origin == "model" else None}
        effect = finding.pop("effect_metric", None)
        strength = finding.pop("strength_metric", None)
        finding["metrics"] = {"effect": effect, "strength": strength,
                              "sample_size": {"value": complete, "label": "Vollständige Referenzzeilen in den genannten Spalten"},
                              "coverage": {"value": complete / n if n else 0, "label": "Anteil vollständiger Referenzzeilen"}}
    return clean_json(findings)


def order_findings(findings, request, coverage):
    kind = request.finding_kind
    origin = request.finding_origin
    origin_filtered = [item for item in findings if origin == "all" or item["result_type"] == origin]
    selected = [item for item in origin_filtered if kind == "all" or item["kind"] == kind]
    if request.finding_sort == "name":
        selected.sort(key=lambda item: (item["title"].casefold(), item["id"]), reverse=request.finding_direction == "desc")
    else:
        def value(item):
            metric = item["metrics"].get(request.finding_sort)
            raw = metric.get("value") if metric else None
            return raw if raw is not None and math.isfinite(raw) else None
        measured = [item for item in selected if value(item) is not None]
        unmeasured = sorted((item for item in selected if value(item) is None), key=lambda item: item["id"])
        measured.sort(key=lambda item: ((-1 if request.finding_direction == "desc" else 1) * value(item), item["id"]))
        selected = measured + unmeasured
    shown = selected[request.finding_offset:request.finding_offset + request.finding_limit]
    coverage.update(candidates=len(findings), matched=len(selected), shown=len(shown), displayed_limit=request.finding_limit,
                    offset=request.finding_offset, sort=request.finding_sort, direction=request.finding_direction,
                    kind_counts=dict(Counter(item["kind"] for item in origin_filtered)),
                    origin_counts=dict(Counter(item["result_type"] for item in findings)))
    return shown
