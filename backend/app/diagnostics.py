"""Descriptive diagnostics with explicit cohorts; no causal or significance claims."""
from __future__ import annotations

import hashlib
import itertools
import json

import numpy as np
import pandas as pd

from .data import clean_json
from .labels import MONTHS
from .explanations import format_number as fmt


def diagnose(result, frame, correlations, keys):
    findings = []
    n = len(frame)
    roles = result["roles"]
    numeric = sorted(result["numeric_columns"])
    categories = sorted(name for name, role in roles.items() if role == "category" and 2 <= frame[name].nunique() <= 30)
    dates = sorted(name for name, role in roles.items() if role == "date")

    def add(tag, identity, kind, title, detail, columns, rows, method, groups=None, cells=None, limitation=None):
        key = hashlib.sha256(json.dumps(identity, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:16]
        findings.append({"id": f"{tag}:{key}", "kind": kind, "title": title, "detail": detail,
                         "evidence": [{"label": "Zugeordnete Zeilen", "value": str(len(rows))}, {"label": "Referenzauswahl", "value": str(n)}],
                         "method": method, "sample_size": n, "scope": "Aktuelle Auswahl",
                         "action": {"view": "data"}, "row_ids": list(rows), "columns": columns,
                         "cell_evidence": cells or [], "comparison_groups": groups or [],
                         "limitation": limitation or "Explorativer Vergleich in dieser Auswahl. Mehrfach geprüfte Muster können zufällig entstehen; die Suchschwellen sind keine fachlichen Grenzwerte."})

    # Missingness by category, calendar month, and category × calendar month.
    partitions = [(name, [frame[name].astype("string")], [name]) for name in categories]
    for date in dates:
        months = frame[date].dt.strftime("%Y-%m").map(lambda value: f"{MONTHS[int(value[5:7]) - 1]} {value[:4]}" if pd.notna(value) else pd.NA)
        partitions.append((date, [months], [date]))
        partitions.extend((f"{category} × {date}", [frame[category].astype("string"), months], [category, date]) for category in categories)
    for column in sorted(frame.columns):
        missing = frame[column].isna()
        if missing.sum() < 5 or (~missing).sum() < 30:
            continue
        for partition, series, context_columns in partitions:
            candidates, groups = [], []
            for key, indexes in frame.groupby(series, dropna=True, sort=True).groups.items():
                ids = list(indexes)
                size, count = len(ids), int(missing.loc[ids].sum())
                other_n, other_missing = n - size, int(missing.sum()) - count
                label = " · ".join(str(value) for value in key) if isinstance(key, tuple) else str(key)
                rate = count / size
                other_rate = other_missing / other_n if other_n else 0
                groups.append({"label": label, "count": size, "missing": count, "rate": rate})
                if size >= 10 and count >= 5 and other_n >= 30 and rate - other_rate >= .25 and rate >= 3 * other_rate:
                    candidates.append((rate - other_rate, count, label, ids, rate, other_rate))
            if not candidates:
                continue
            _, count, label, ids, rate, other_rate = max(candidates, key=lambda item: (item[0], item[1], item[2]))
            affected = [i for i in ids if missing.at[i]]
            add("missing_pattern", [column, partition, label], "quality", f"{column}: {fmt(rate * 100, 1)} % ohne Wert in {label}",
                f"Nach {partition}: {count} von {len(ids)} Werten fehlen ({fmt(rate * 100, 1)} %), gegenüber {fmt(other_rate * 100, 1)} % in den übrigen Zeilen.",
                list(dict.fromkeys([column, *context_columns])), affected, "Fehlwertrate je Gruppe/Monat; mindestens zehn Zeilen, fünf Fehlwerte, 30 übrige Zeilen, 25 Prozentpunkte und mindestens dreifache Rate gegenüber dem Rest.",
                sorted(groups, key=lambda group: (-group["rate"], group["label"]))[:20],
                [{"column": column, "kind": "missing", "reference_n": n, "rule": f"Fehlender Wert innerhalb {partition}: {label}"}])

    if keys:
        complete = frame.dropna(subset=keys)
        repeated = complete.duplicated(subset=keys, keep=False)
        if repeated.any():
            groups = complete.loc[repeated].groupby(keys, dropna=False).size().sort_values(ascending=False)
            add("key_duplicates", sorted(keys), "quality", f"{int(repeated.sum())} Zeilen teilen denselben gewählten Schlüssel",
                f"{len(groups)} mehrfach vorkommende Schlüssel für {', '.join(keys)}. {n - len(complete)} Zeilen mit unvollständigem Schlüssel wurden aus der Duplikatprüfung ausgeschlossen.",
                keys, complete.index[repeated].tolist(), "Exakter Vergleich der vom Nutzer gewählten Schlüsselspalten; alle Mitglieder mehrfach vorkommender vollständiger Schlüssel werden zugeordnet.",
                [{"label": str(key), "count": int(count)} for key, count in groups.head(20).items()],
                [{"column": key, "kind": "duplicate", "reference_n": len(complete), "rule": "Vollständiger gewählter Schlüssel kommt mehrfach vor"} for key in keys],
                "Wiederholte Schlüssel beschreiben gleiche gewählte Wertkombinationen und sind kein automatischer Fehlernachweis.")

    # Strong linear redundancy and sensitivity to a small observed subset.
    for item in correlations:
        x, y, r = item["x"], item["y"], item["value"]
        if item["count"] < 30 or abs(r) < .5:
            continue
        pair = frame[[x, y]].dropna()
        if len(pair) < 30:
            continue
        if abs(r) >= .995 and abs(item.get("spearman") or 0) >= .995:
            xv, yv = pair[x].to_numpy(), pair[y].to_numpy()
            slope = float(np.cov(xv, yv, ddof=0)[0, 1] / np.var(xv))
            intercept = float(yv.mean() - slope * xv.mean())
            residual = float(np.sqrt(np.mean((yv - (slope * xv + intercept)) ** 2)) / np.std(yv))
            if residual <= .01:
                add("redundancy", [x, y], "relation", f"{x} / {y}: relative lineare Reststreuung {fmt(residual * 100, 2)} %",
                    f"Pearson r = {fmt(r, 3)}, relative Reststreuung {fmt(residual * 100, 2)} %. Näherung: {y} = {fmt(slope, 4)} × {x} + {fmt(intercept, 4)}.",
                    [x, y], pair.index.tolist(), "Mindestens 30 vollständige Paare, |Pearson| und |Spearman| ≥ 0,995; Reststreuung relativ zur Zielstreuung ≤ 1 %.",
                    limitation="Die lineare Anpassung beschreibt diese vollständigen Beobachtungen und enthält keine Aussage über Ursachen oder die fachliche Bedeutung der Spalten.")
                findings[-1]["strength_metric"] = {"value": abs(r), "label": "Absoluter Pearson r"}
        if len(pair) < 33 or abs(r) < .5:
            continue
        # Compute exact leave-one-out correlations from centered sums, O(n).
        a, b = pair[x].to_numpy(), pair[y].to_numpy()
        a, b = a - a.mean(), b - b.mean()
        m = len(pair)
        xx, yy, xy = np.dot(a, a), np.dot(b, b), np.dot(a, b)
        denominator = np.sqrt(np.maximum(0, xx - a*a*m/(m-1)) * np.maximum(0, yy - b*b*m/(m-1)))
        loo = np.divide(xy - a*b*m/(m-1), denominator, out=np.full(m, np.nan), where=denominator > 0)
        order = np.argsort(-np.nan_to_num(np.abs(loo - r), nan=-1), kind="stable")[:3]
        rest = pair.drop(pair.index[order])
        after = rest[x].corr(rest[y])
        if pd.notna(after) and abs(r - after) >= .35:
            add("sensitivity", [x, y], "relation", f"{x} / {y}: r = {fmt(r)}; ohne drei Zeilen r = {fmt(after)}",
                f"Nach Auslassen von drei anhand ihrer Einzelwirkung ausgewählten Beobachtungen ändert sich Pearson r von {fmt(r)} auf {fmt(after)}. Verbleibende vollständige Paare: {len(rest)}.",
                [x, y], pair.index[order].tolist(), "Exakte Einzel-Auslassvergleiche; die drei größten Änderungen werden gemeinsam ausgelassen. Mindestens 33 Paare und Änderung von r um ≥ 0,35.",
                [{"label": "Alle vollständigen Paare", "count": m, "correlation": r}, {"label": "Ohne ausgewählte drei", "count": len(rest), "correlation": float(after)}],
                limitation="Eine Sensitivitätsanalyse, kein Fehlernachweis. Die drei Beobachtungen können korrekt und fachlich wesentlich sein; es wird nicht die weltweit stärkste Dreierkombination gesucht.")
            findings[-1]["strength_metric"] = {"value": abs(r), "label": "Absoluter Pearson r vor dem Auslassen"}

    # Stratified relationships: compute full correlation matrices per cohort.
    global_r = {(item["x"], item["y"]): item for item in correlations}
    for category in categories:
        if frame[category].nunique() > 6:
            continue
        cohorts = [(str(key), part) for key, part in frame.dropna(subset=[category]).groupby(category) if len(part) >= 20]
        matrices = [(label, part, part[numeric].corr()) for label, part in cohorts]
        for x, y in itertools.combinations(numeric, 2):
            overall = global_r.get((x, y))
            if not overall or overall["count"] < 40 or abs(overall["value"]) > .3:
                continue
            directions = [float(corr.loc[x, y]) for _, _, corr in matrices if pd.notna(corr.loc[x, y]) and abs(corr.loc[x, y]) >= .6]
            if len(directions) < 2 or not (all(value > 0 for value in directions) or all(value < 0 for value in directions)):
                continue
            groups, ids = [], []
            for label, part, corr in matrices:
                pair = part[[x, y]].dropna()
                value = corr.loc[x, y]
                if len(pair) >= 20 and pd.notna(value):
                    groups.append({"label": label, "count": len(pair), "correlation": float(value)})
                    ids.extend(pair.index.tolist())
            strong = [group for group in groups if abs(group["correlation"]) >= .6]
            if len(strong) >= 2 and (all(group["correlation"] > 0 for group in strong) or all(group["correlation"] < 0 for group in strong)):
                add("within_groups", [category, x, y], "relation", f"{x} / {y}: Gesamt-r = {fmt(overall['value'])}; Gruppenvergleich nach {category}",
                    f"Gesamt-r = {fmt(overall['value'])}; innerhalb von {len(strong)} Gruppen nach {category} ist |r| mindestens 0,6 und gleichgerichtet.",
                    [x, y, category], sorted(ids), "Mindestens 40 vollständige Paare insgesamt, mindestens zwei Gruppen mit je 20 Paaren und gleichgerichtetem |r| ≥ 0,6; global |r| ≤ 0,3.",
                    [{"label": "Gesamt", "count": overall["count"], "correlation": overall["value"]}] + groups,
                    limitation="Explorative gruppenabhängige Korrelationen. Unterschiedliche Gruppenzusammensetzungen können globale und lokale Zusammenhänge verändern; daraus folgt keine Kausalität.")
                findings[-1]["strength_metric"] = {"value": min(abs(group["correlation"]) for group in strong), "label": "Minimales absolutes Pearson r der ausgewiesenen Gruppen"}

    # Observed combinations much rarer than an independence reference predicts.
    if n >= 200:
        for x, y in itertools.combinations(categories, 2):
            pair = frame[[x, y]].dropna().astype(str)
            if len(pair) < 200:
                continue
            table = pd.crosstab(pair[x], pair[y])
            expected = np.outer(table.sum(axis=1), table.sum(axis=0)) / len(pair)
            candidates = []
            for i, left in enumerate(table.index):
                for j, right in enumerate(table.columns):
                    observed, mean = int(table.iloc[i, j]), float(expected[i, j])
                    if 1 <= observed <= 2 and mean >= 15 and observed / mean <= .1:
                        candidates.append((observed / mean, left, right, observed, mean))
            if candidates:
                _, left, right, observed, mean = min(candidates)
                ids = pair.index[(pair[x] == left) & (pair[y] == right)].tolist()
                add("rare_combination", [x, y, left, right], "anomaly", f"Kombination {x} = {left}, {y} = {right}: {observed} Beobachtungen",
                    f"Gemeinsam {observed} Mal beobachtet; Produkt der beobachteten Randanteile × Zeilenzahl: {fmt(mean, 1)} (Unabhängigkeitsreferenz).",
                    [x, y], ids, "Mindestens 200 vollständige Paare; beobachtet ein bis zwei, Unabhängigkeitsreferenz ≥ 15 und Verhältnis ≤ 0,1. Pro Spaltenpaar wird die stärkste beobachtete Abweichung gezeigt.",
                    cells=[{"column": column, "kind": "combination", "reference_n": len(pair), "rule": f"Selten gemeinsam: {left} / {right}; Unabhängigkeitsreferenz {fmt(mean, 1)}"} for column in [x, y]],
                    limitation="Die Unabhängigkeitsannahme ist eine Vergleichshilfe. Die Häufigkeiten beschreiben diese Auswahl. Keine Fehlerwahrscheinlichkeit oder Signifikanzbehauptung.")
    return clean_json(findings)
