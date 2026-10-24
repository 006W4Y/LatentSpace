"""Observed comparisons for model flags, deliberately not feature attributions."""
from __future__ import annotations

import numpy as np
import pandas as pd

from .data import clean_json


def format_number(value: float, digits: int = 2) -> str:
    if not np.isfinite(value):
        return "–"
    if value != 0 and abs(value) < 0.01:
        return f"{value:.3g}".replace(".", ",")
    text = f"{value:,.{digits}f}".rstrip("0").rstrip(".") if digits else f"{value:,.0f}"
    return text.replace(",", "TEMP").replace(".", ",").replace("TEMP", ".")


def reference_stats(values) -> dict | None:
    values = np.asarray(values, dtype=float)
    values = values[np.isfinite(values)]
    if len(values) < 3:
        return None
    q1, median, q3 = np.quantile(values, [.25, .5, .75])
    mad = np.median(np.abs(values - median))
    scale = mad * 1.4826
    if scale <= 1e-12:
        scale = (q3 - q1) / 1.349
    if scale <= 1e-12:
        scale = float(np.std(values))
    return {"n": len(values), "median": median, "q1": q1, "q3": q3, "min": values.min(), "max": values.max(), "scale": scale}


def comparison(feature: str, value: float, values, kind: str, other_features: list[str], fallback_scale: float = 0) -> dict | None:
    stats = reference_stats(values)
    if stats is None:
        return None
    observed = np.asarray(values, dtype=float)
    observed = observed[np.isfinite(observed)]
    delta = value - stats["median"]
    scale = stats["scale"] if stats["scale"] > 1e-12 else fallback_scale
    magnitude = abs(delta) / scale if scale > 1e-12 else None
    # A constant peer reference has no robust spread. Report its observed range;
    # only prioritize a discrepancy when it is material in the global scale.
    constant_discrepancy = stats["min"] == stats["max"] and not np.isclose(value, stats["median"], rtol=1e-9, atol=1e-12) and (scale <= 1e-12 or abs(delta) >= .2 * scale)
    iqr = stats["q3"] - stats["q1"]
    outside_fence = bool(iqr > 1e-12 and (value < stats["q1"] - 1.5 * iqr or value > stats["q3"] + 1.5 * iqr))
    evidence = (magnitude is not None and magnitude >= 3) or outside_fence or constant_discrepancy
    rule, criterion = None, None
    if constant_discrepancy:
        rule = "constant"
        criterion = f"Alle {stats['n']} Vergleichswerte liegen bei {format_number(stats['median'])}; dieser Wert weicht davon ab."
    elif outside_fence:
        rule = "iqr"
        criterion = f"Außerhalb der Quartilsgrenzen: unter {format_number(stats['q1'] - 1.5 * iqr)} oder über {format_number(stats['q3'] + 1.5 * iqr)} (1,5 × Quartilsabstand)."
    elif magnitude is not None and magnitude >= 3:
        rule = "distance"
        criterion = f"Abstand zum Vergleichsmedian: {format_number(magnitude)} Vergleichsstreuungen; die Schwelle beträgt 3."
    rank = float(100 * ((observed < value).sum() + .5 * (observed == value).sum()) / len(observed))
    direction = "höher" if delta > 0 else "niedriger" if delta < 0 else "gleich"
    scope = "der Nachbarreferenz" if kind == "context" else "der übrigen Zeilen"
    return clean_json({
        "feature": feature, "value": value, "kind": kind, "direction": direction,
        "median": stats["median"], "q1": stats["q1"], "q3": stats["q3"],
        "min": stats["min"], "max": stats["max"], "reference_n": stats["n"],
        "percentile": rank, "deviation": magnitude, "is_evidence": bool(evidence),
        "rule": rule, "criterion": criterion,
        "other_features": other_features,
        "title": f"{feature}: {direction} als der Vergleichsmedian" if delta else f"{feature}: am Vergleichsmedian",
        "detail": f"Wert {format_number(value)} gegenüber Median {format_number(stats['median'])} {scope}. Die mittleren 50 % liegen zwischen {format_number(stats['q1'])} und {format_number(stats['q3'])}.",
    })


def explain_row(result: dict, row_id: int) -> dict:
    frame = result["_frame"]
    if row_id not in frame.index:
        raise KeyError(row_id)
    cache = result.setdefault("_explanations", {})
    if row_id in cache:
        return cache[row_id]
    row = result["rows"][row_id]
    matrix = result.get("_matrix")
    available = matrix is not None and bool(result["features"])
    reasons = []
    missing = []
    if available:
        squared = (matrix - matrix[row_id]) ** 2
        observed_matrix = result.get("_observed_matrix")
        if observed_matrix is None:
            observed_matrix = frame[result["features"]].to_numpy(dtype=float)
            result["_observed_matrix"] = observed_matrix
        for index, feature in enumerate(result["features"]):
            value = frame.at[row_id, feature]
            if pd.isna(value):
                missing.append(feature)
                continue
            source = frame[feature].to_numpy(dtype=float)
            valid = np.isfinite(source)
            valid[row_id] = False  # Never use the inspected row as its own reference.
            global_comparison = comparison(feature, float(value), source[valid], "global", [])
            if global_comparison is None:
                continue
            chosen = global_comparison
            other_indices = [i for i in range(len(result["features"])) if i != index and np.isfinite(observed_matrix[row_id, i])]
            peer_valid = valid & np.isfinite(observed_matrix[:, other_indices]).all(axis=1)
            if other_indices and peer_valid.sum() >= 5:
                # Peers are chosen from the OTHER features. The feature being
                # explained cannot select its own favorable comparison group.
                distances = squared[:, other_indices].sum(axis=1)
                distances[~peer_valid] = np.inf
                k = min(20, int(peer_valid.sum()))
                threshold = np.partition(distances, k - 1)[k - 1]
                peers = np.flatnonzero(peer_valid & (distances <= threshold + max(1e-12, abs(threshold) * 1e-10)))
                # Nearest does not necessarily mean similar. Do not label a
                # remote set of points as a local reference for an isolated row.
                if float(np.median(np.sqrt(distances[peers] / len(other_indices)))) > .75:
                    reasons.append(chosen)
                    continue
                global_stats = reference_stats(source[valid])
                contextual = comparison(feature, float(value), source[peers], "context", [result["features"][i] for i in other_indices], global_stats["scale"] if global_stats else 0)
                if contextual and contextual["is_evidence"] and (contextual["deviation"] or 0) > (chosen["deviation"] or 0):
                    chosen = contextual
            reasons.append(chosen)
    reasons.sort(key=lambda item: (item["is_evidence"], item["deviation"] or 0), reverse=True)
    evidence = [item for item in reasons if item["is_evidence"]]
    if evidence:
        leading = evidence[0]
        context = "der Nachbarreferenz" if leading["kind"] == "context" else "den übrigen Zeilen"
        summary = f"{leading['feature']} ist mit {format_number(leading['value'])} {leading['direction']} als der Median von {format_number(leading['median'])} bei {context}."
    elif available and row["anomaly"]:
        summary = "Das Modell markiert diese Zeile. Keine der Einzelwertregeln liefert hier einen Treffer."
    elif available:
        summary = "Das Modell markiert diese Zeile nicht. Die Vergleiche zeigen, wie ihre Messwerte im Datensatz liegen."
    else:
        summary = "Für diesen Datensatz liegt keine Modellbewertung vor."
    scores = np.array([item["score"] for item in result["rows"]])
    score_percentile = float(100 * ((scores < row["score"]).sum() + .5 * (scores == row["score"]).sum()) / len(scores)) if available else None
    explanation = {
        "row_id": row_id, "available": available, "flagged": row["anomaly"],
        "score": row["score"], "score_percentile": score_percentile,
        "summary": summary, "reasons": evidence, "comparisons": reasons[:5],
        "assessment": "value_deviation" if evidence else "model_only" if available and row["anomaly"] else "unmarked" if available else "unavailable",
        "missing_features": missing, "reference_scope": "Gesamter Datensatz, ohne die untersuchte Zeile",
        "method": "Statistische Vergleiche mit Median und Quartilen. Ein Einzelhinweis erfordert einen Wert außerhalb der 1,5-fachen Quartilsgrenzen, mindestens drei Vergleichsstreuungen Abstand vom Median oder eine Abweichung von konstanten Referenzwerten. Als Vergleichsstreuung dient MAD × 1,4826, ersatzweise Quartilsabstand / 1,349 oder Standardabweichung; bei konstanter lokaler Referenz ersatzweise die globale Streuung. Eine Abweichung von konstanten Referenzwerten muss bei vorhandener Streuung mindestens 0,2 Vergleichsstreuungen betragen. Die nächsten 20 Zeilen (bei kleineren Datensätzen entsprechend weniger) werden anhand der jeweils anderen standardisierten, tatsächlich beobachteten Modellmerkmale ausgewählt; zusätzliche Gleichstände an der Grenze sind eingeschlossen. Zeilen mit fehlenden Vergleichsmerkmalen werden ausgelassen. Lokale Vergleiche werden nur bei mindestens fünf Referenzwerten und medianem RMS-Abstand von höchstens 0,75 Standardabweichungen verwendet.",
        "limitation": "Die Vergleiche beschreiben beobachtete Abweichungen. Sie sind keine exakte Zerlegung des Isolation-Forest-Scores und erklären keine Ursachen.",
    }
    # Bounded cache: avoid retaining a growing copy of all point explanations.
    if len(cache) >= 256:
        cache.pop(next(iter(cache)))
    cache[row_id] = explanation
    return explanation
