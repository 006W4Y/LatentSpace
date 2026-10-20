"""Portable findings for an analyst; never modifies imported records."""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone

from .analysis import ExploreRequest, explore


def build_report(result: dict, request: ExploreRequest) -> dict:
    exploration = explore(result, request)
    source = json.dumps([row["values"] for row in result["rows"]], ensure_ascii=False, sort_keys=True).encode()
    return {
        "report_version": "1.0", "created_at": datetime.now(timezone.utc).isoformat(),
        "dataset": {"id": result["dataset_id"], "name": result["name"], "rows": len(result["rows"]), "fingerprint_sha256": hashlib.sha256(source).hexdigest()},
        "selection": {"count": exploration["count"], "row_ids": exploration["filtered_ids"], "filters": request.model_dump()},
        "analysis": {"config": result["config"], "seed": result["seed"], "versions": result["versions"], "features": result["features"]},
        "insights": exploration["insights"], "profiles": exploration["profiles"],
        "correlations": exploration["correlations"],
        "anomaly_count": exploration["anomaly_count"], "explained_anomalies": exploration["anomalies"],
        "notices": result["notices"],
        "limitations": [
            "Alle Befunde sind explorativ und beschreiben beobachtete Daten. Es werden keine kausalen oder statistisch signifikanten Effekte behauptet.",
            "Cluster, Anomaliescores und Zeilenerklärungen beziehen sich auf den gesamten analysierten Datensatz; beschreibende Insights beziehen sich auf die aktuelle Auswahl.",
            "Anomalievergleiche sind keine exakte Feature-Attribution des Modells. Fehlende Originalwerte werden nicht als beobachtete Messwerte erklärt.",
            "Originaldaten wurden nicht verändert. Ergänzung und Skalierung betreffen ausschließlich die interne Modellanalyse.",
        ],
    }


def markdown_report(report: dict) -> str:
    def text(value):
        value = str(value).replace("\n", " ").replace("\r", " ")
        for char in ["\\", "`", "*", "_", "[", "]", "<", ">", "#", "|"]:
            value = value.replace(char, "\\" + char)
        return value
    lines = ["# LatentSpace · Analysebericht", "", f"Datensatz: **{text(report['dataset']['name'])}**", f"Erstellt: {report['created_at']}", f"Auswahl: {report['selection']['count']} von {report['dataset']['rows']} Zeilen", f"Datensatz-ID: {report['dataset']['id']}", f"SHA-256 der Originalwerte: `{report['dataset']['fingerprint_sha256']}`", "", "## Erkenntnisse", ""]
    if not report["insights"]:
        lines.extend(["Für diese Auswahl wurden keine automatischen Befunde erzeugt.", ""])
    for insight in report["insights"]:
        lines.extend([f"### {text(insight['title'])}", "", text(insight["detail"]), "", f"Methode: {text(insight['method'])}", f"Bezug: aktuelle Auswahl mit {insight['sample_size']} Zeilen.", f"Einordnung: {text(insight['limitation'])}"])
        if insight["row_ids"]:
            lines.append("Betroffene Datenzeilen (1-basiert): " + ", ".join(str(i + 1) for i in insight["row_ids"][:100]) + (" … vollständige IDs im JSON-Bericht." if len(insight["row_ids"]) > 100 else ""))
        lines.append("")
    lines.extend(["## Auffällige Zeilen und Vergleichswerte", "", f"{report['anomaly_count']} Markierungen in der Auswahl. Die bis zu 30 höchsten Scores werden erläutert.", ""])
    for row in report["explained_anomalies"]:
        explanation = row["explanation"]
        lines.extend([f"### Zeile {row['id'] + 1} · Score {row['score']:.4f}", "", text(explanation["summary"])])
        for reason in explanation["reasons"]:
            scope = "ähnliche Zeilen in den anderen Modellmerkmalen" if reason["kind"] == "context" else "übriger Gesamtdatensatz"
            lines.append(f"- {text(reason['feature'])}: {text(reason['detail'])} Vergleich: {scope}, n={reason['reference_n']}.")
        lines.append("")
    lines.extend(["## Analyseparameter und Filter", "", "```json", json.dumps({"analysis": report["analysis"], "filters": report["selection"]["filters"]}, ensure_ascii=False, indent=2), "```", "", "## Grenzen der Auswertung", ""])
    lines.extend("- " + text(value) for value in report["limitations"])
    if report["notices"]:
        lines.extend(["", "## Verarbeitungshinweise", ""])
        lines.extend("- " + text(value) for value in report["notices"])
    return "\n".join(lines) + "\n"
