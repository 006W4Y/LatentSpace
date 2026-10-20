"""Deterministic, evidence-backed discoveries and semantically labeled profiles."""
from __future__ import annotations

import re

import numpy as np
import pandas as pd

from .data import clean_json
from .explanations import format_number

MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"]


def build_profile(name: str, role: str, series: pd.Series) -> dict:
    present = series.dropna()
    item = {"name": name, "role": role, "missing": int(series.isna().sum()), "unique": int(series.nunique()), "observed": len(present), "distribution": [], "distribution_kind": "categories", "summary": "Keine beobachteten Werte.", "distribution_note": ""}
    if role == "number":
        item.update(mean=present.mean(), median=present.median(), min=present.min(), max=present.max())
        item["distribution_kind"] = "histogram"
        if len(present):
            q1, q3 = present.quantile([.25, .75])
            item.update(q1=q1, q3=q3)
            item["summary"] = f"Die mittleren 50 % liegen zwischen {format_number(q1)} und {format_number(q3)}."
            month_code = bool(re.fullmatch(r"monat|month|monatsnummer|month_index", name.strip(), re.I))
            integer_codes = bool((present == np.floor(present)).all())
            if month_code and integer_codes and present.min() >= 0 and present.max() <= 12:
                zero_based = bool((present == 0).any())
                if not zero_based or present.max() <= 11:
                    counts = present.astype(int).value_counts().sort_index()
                    item["distribution_kind"] = "month_codes"
                    item["distribution"] = [{"label": MONTHS[int(code) if zero_based else int(code) - 1], "count": int(count)} for code, count in counts.items()]
                    item["distribution_note"] = "Monatscodes: 0 = Januar." if zero_based else "Monatscodes: 1 = Januar."
                    return clean_json(item)
            if integer_codes and present.nunique() <= 15:
                item["distribution_kind"] = "discrete"
                item["distribution"] = [{"label": format_number(float(value), 0), "count": int(count)} for value, count in present.value_counts().sort_index().items()]
                item["distribution_note"] = "Anzahl je beobachtetem Messwert."
                return clean_json(item)
            counts, edges = np.histogram(present, bins=min(12, max(1, present.nunique())))
            digits = 2 if edges[-1] - edges[0] < 2 else 1 if edges[-1] - edges[0] < 20 else 0
            item["distribution"] = [{"label": f"{format_number(edges[i])} – {format_number(edges[i + 1])}", "short_label": format_number(edges[i], digits), "count": int(count), "start": float(edges[i]), "end": float(edges[i + 1])} for i, count in enumerate(counts)]
            item["distribution_note"] = "Wertebereiche · rechte Grenze nur in der letzten Klasse eingeschlossen."
    elif role == "date":
        item["distribution_kind"] = "calendar"
        if len(present):
            months = (present.max().year - present.min().year) * 12 + present.max().month - present.min().month
            freq = "MS" if months < 24 else "YS"
            counts = pd.Series(1, index=pd.DatetimeIndex(present)).groupby(pd.Grouper(freq=freq)).sum()
            item["distribution"] = [{"label": f"{MONTHS[date.month - 1]} {date.year}" if freq == "MS" else str(date.year), "short_label": f"{MONTHS[date.month - 1][:3]} {str(date.year)[2:]}" if freq == "MS" else str(date.year), "count": int(count), "key": date.isoformat()} for date, count in counts.items()]
            item["summary"] = f"{present.min().strftime('%d.%m.%Y')} bis {present.max().strftime('%d.%m.%Y')}."
            item["distribution_note"] = "Zeilen pro Kalendermonat · chronologisch." if freq == "MS" else "Zeilen pro Kalenderjahr · chronologisch."
    elif role in {"identifier", "text"}:
        item["distribution_kind"] = role
        if len(present):
            share = series.nunique() / len(present) * 100
            item["summary"] = f"{format_number(share, 1)} % der beobachteten Werte sind verschieden."
            item["distribution_note"] = "Kennungen werden nicht als Messwerte interpretiert." if role == "identifier" else "Freitext wird in dieser Analyse nicht semantisch bewertet."
    elif len(present):
        counts = present.astype(str).value_counts()
        top = counts.head(6)
        item["distribution"] = [{"label": str(label), "count": int(count)} for label, count in top.items()]
        if len(counts) > 6:
            item["distribution"].append({"label": f"Weitere ({len(counts) - 6})", "count": int(counts.iloc[6:].sum())})
        item["summary"] = f"{top.index[0]} ist mit {format_number(float(top.iloc[0]) / len(present) * 100, 1)} % am häufigsten."
        item["distribution_note"] = "Häufigste Kategorien · weitere Kategorien zusammengefasst." if len(counts) > 6 else "Häufigkeit je Kategorie."
    return clean_json(item)


def discover(result: dict, subset: pd.DataFrame, profiles: list[dict], correlations: list[dict], anomaly_count: int) -> list[dict]:
    if subset.empty:
        return []
    insights = []
    n = len(subset)
    roles = result["roles"]
    numeric = result["numeric_columns"]
    def add(kind, key, title, detail, evidence, method, priority, action, limitation, row_ids=None):
        insights.append({"id": key, "kind": kind, "title": title, "detail": detail, "evidence": evidence, "method": method, "priority": priority, "sample_size": n, "scope": "Aktuelle Auswahl", "action": action, "limitation": limitation, "row_ids": list(row_ids or [])})
    for profile in profiles:
        name = profile["name"]
        if profile["missing"]:
            missing = profile["missing"]
            share = missing / n * 100
            add("quality", f"missing:{name}", f"{name}: {format_number(share, 1)} % ohne Wert", f"In {missing} von {n} Zeilen fehlt dieser Wert. Auswertungen dieses Merkmals basieren auf den übrigen Beobachtungen.", [{"label": "Fehlende Werte", "value": str(missing)}, {"label": "Anteil", "value": f"{format_number(share, 1)} %"}], "Anzahl fehlender beziehungsweise nicht lesbarer Werte", 55 + min(share, 20), {"view": "data"}, "Ein fehlender Eintrag ist nicht automatisch ein Fehler.", subset.index[subset[name].isna()].tolist())
        if roles[name] == "category" and profile["observed"] >= 20 and profile["unique"] >= 2:
            counts = subset[name].dropna().astype(str).value_counts()
            share = counts.iloc[0] / counts.sum() * 100
            if share >= 50:
                add("group", f"concentration:{name}", f"{name} konzentriert sich auf {counts.index[0]}", f"{counts.index[0]} umfasst {format_number(share, 1)} % der Zeilen mit vorhandenem {name}. Die Verteilung ist ungleich.", [{"label": "Größte Kategorie", "value": str(counts.index[0])}, {"label": "Anteil", "value": f"{format_number(share, 1)} %"}], "Kategoriehäufigkeiten ohne fehlende Werte", 48, {"view": "groups", "group_column": name, "aggregation": "count"}, "Die Verteilung kann durch die Erhebung oder Auswahl entstehen.")
        if roles[name] == "number" and profile["observed"] >= 12:
            q1, q3 = profile.get("q1"), profile.get("q3")
            if q1 is not None and q3 is not None and q3 > q1:
                low, high = q1 - 1.5 * (q3 - q1), q3 + 1.5 * (q3 - q1)
                outliers = subset.index[(subset[name] < low) | (subset[name] > high)].tolist()
                if outliers:
                    add("anomaly", f"range:{name}", f"{name}: {len(outliers)} Werte außerhalb des Vergleichsbereichs", f"Die Quartilsregel setzt hier Grenzen bei {format_number(low)} und {format_number(high)}. Diese Zeilen verdienen eine genauere Prüfung.", [{"label": "Betroffene Zeilen", "value": str(len(outliers))}, {"label": "Vergleichsmedian", "value": format_number(profile["median"])}], "1,5 × Interquartilsabstand außerhalb des ersten/dritten Quartils", 83, {"view": "data"}, "Der Vergleichsbereich ist eine statistische Orientierung, keine fachlich zulässige Grenze.", outliers)
            if profile["unique"] == 1:
                add("quality", f"constant:{name}", f"{name} liefert keine Unterschiede", f"Alle {profile['observed']} beobachteten Werte sind {format_number(profile['median'])}. Dieses Merkmal trennt die Zeilen in dieser Auswahl nicht.", [{"label": "Beobachteter Wert", "value": format_number(profile["median"])}], "Anzahl verschiedener numerischer Werte", 35, {"view": "data"}, "Konstante Merkmale können im fachlichen Kontext trotzdem relevant sein.")
    for item in correlations[:5]:
        if item["count"] >= 10 and abs(item["value"]) >= .4:
            add("relation", f"correlation:{item['x']}:{item['y']}", f"{item['x']} und {item['y']} bewegen sich {'gleichläufig' if item['value'] > 0 else 'gegenläufig'}", f"Der lineare Zusammenhang beträgt {format_number(item['value'])}; die Rangkorrelation liegt bei {format_number(item.get('spearman', float('nan')))}. Beide Werte basieren auf {item['count']} vollständigen Wertepaaren.", [{"label": "Pearson r", "value": format_number(item["value"])}, {"label": "Spearman ρ", "value": format_number(item.get("spearman", float("nan")))}, {"label": "Wertepaare", "value": str(item["count"])}], "Pearson- und Spearman-Korrelation", 65 + abs(item["value"]) * 10, {"view": "relations", "value_column": item["x"]}, "Korrelation belegt keine Ursache; Ausreißer und Auswahl können das Ergebnis beeinflussen.")
    # Compare sufficiently populated groups using medians, not just totals.
    categories = [name for name, role in roles.items() if role == "category"][:8]
    for category in categories:
        count = subset[category].nunique()
        if count < 2 or count > 30:
            continue
        for value_column in numeric[:10]:
            groups = subset.dropna(subset=[category, value_column]).groupby(category)[value_column].agg(["median", "count"])
            groups = groups.loc[groups["count"] >= 10].sort_values("median")
            if len(groups) < 2:
                continue
            low, high = groups.iloc[0], groups.iloc[-1]
            spread = subset[value_column].quantile(.75) - subset[value_column].quantile(.25)
            difference = high["median"] - low["median"]
            if not np.isfinite(spread) or spread <= 0 or difference < .5 * spread:
                continue
            add("group", f"difference:{category}:{value_column}", f"{value_column} unterscheidet sich nach {category}", f"{groups.index[-1]} erreicht einen Median von {format_number(high['median'])}, {groups.index[0]} einen Median von {format_number(low['median'])}. Die verglichenen Gruppen haben {int(high['count'])} beziehungsweise {int(low['count'])} vollständige Werte.", [{"label": str(groups.index[-1]), "value": format_number(high["median"])}, {"label": str(groups.index[0]), "value": format_number(low["median"])}], "Vergleich von Gruppenmedianen; mindestens zehn Werte je Gruppe", 72 + min(difference / spread, 5), {"view": "groups", "group_column": category, "value_column": value_column, "aggregation": "median"}, "Mediane beschreiben die beobachteten Gruppen. Gruppenunterschiede sind keine kausalen Effekte.")
    # Use only calendar months whose full boundaries are covered by the data.
    # Differences remain descriptive and are not called statistically significant.
    for date_column in [name for name, role in roles.items() if role == "date"][:2]:
        dated = subset.loc[subset[date_column].notna()]
        if len(dated) < 20:
            continue
        start, end = dated[date_column].min().floor("D"), dated[date_column].max().floor("D")
        for value_column in numeric[:8]:
            monthly = dated.groupby(pd.Grouper(key=date_column, freq="MS"))[value_column].agg(["mean", "count"])
            candidates = []
            for i in range(1, len(monthly)):
                prev, current = monthly.iloc[i - 1], monthly.iloc[i]
                month_end = (monthly.index[i] + pd.offsets.MonthEnd()).floor("D")
                if monthly.index[i - 1] < start or month_end > end or min(prev["count"], current["count"]) < 5:
                    continue
                if not np.isfinite(prev["mean"]) or not np.isfinite(current["mean"]):
                    continue
                scale = float((dated[value_column].quantile(.75) - dated[value_column].quantile(.25)) / 1.349)
                if not np.isfinite(scale) or scale <= 0:
                    scale = float(dated[value_column].std())
                delta = current["mean"] - prev["mean"]
                if not np.isfinite(scale) or scale <= 0 or abs(delta) < .15 * scale:
                    continue
                candidates.append((abs(delta) / scale, i, delta))
            if not candidates:
                continue
            _, i, delta = max(candidates)
            previous, current = monthly.iloc[i - 1], monthly.iloc[i]
            before, after = monthly.index[i - 1], monthly.index[i]
            change = f"{format_number(delta / abs(previous['mean']) * 100, 1)} %" if previous["mean"] > 0 else format_number(delta)
            add("trend", f"time:{date_column}:{value_column}", f"{value_column}: {'höherer' if delta > 0 else 'niedrigerer'} Durchschnitt im {MONTHS[after.month - 1]}", f"Von {MONTHS[before.month - 1]} {before.year} auf {MONTHS[after.month - 1]} {after.year} verändert sich der Durchschnitt von {format_number(previous['mean'])} auf {format_number(current['mean'])} ({change}). Grundlage sind {int(previous['count'])} und {int(current['count'])} beobachtete Werte.", [{"label": f"{MONTHS[before.month - 1]} {before.year}", "value": format_number(previous["mean"])}, {"label": f"{MONTHS[after.month - 1]} {after.year}", "value": format_number(current["mean"])}, {"label": "Veränderung", "value": change}], "Vergleich benachbarter Monatsmittel innerhalb des abgedeckten Kalenderzeitraums", 78, {"view": "trends", "date_column": date_column, "value_column": value_column, "aggregation": "mean", "period": "month"}, "Die Änderung ist deskriptiv. Andere Gruppenzusammensetzung oder unvollständige Erfassung können sie erklären; es ist keine Prognose.")
    if anomaly_count:
        add("anomaly", "model:anomalies", f"{anomaly_count} Zeilen mit ungewöhnlicher Merkmalskombination", "Die Modellmarkierungen lassen sich jetzt anhand einzelner Messwerte und vergleichbarer Zeilen untersuchen. Öffne ein Beispiel für die konkreten Vergleiche.", [{"label": "Markierte Zeilen", "value": str(anomaly_count)}, {"label": "Anteil der Auswahl", "value": f"{format_number(anomaly_count / n * 100, 1)} %"}], "Isolation Forest auf den gewählten Modellmerkmalen", 70, {"view": "anomalies"}, "Modell und Erklärungsvergleiche verwenden den gesamten Datensatz; die Anzahl bezieht sich auf die aktuelle Auswahl.")
    insights.sort(key=lambda item: item["priority"], reverse=True)
    # Keep a useful variety: no more than four discoveries from one family.
    selected, counts = [], {}
    for insight in insights:
        kind = insight["kind"]
        if counts.get(kind, 0) >= 4:
            continue
        selected.append(insight)
        counts[kind] = counts.get(kind, 0) + 1
        if len(selected) >= 16:
            break
    return clean_json(selected)
