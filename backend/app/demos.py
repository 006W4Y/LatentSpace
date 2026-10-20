"""Independent synthetic datasets; every sample uses the ordinary analysis pipeline."""
from __future__ import annotations

import numpy as np
import pandas as pd

from .data import save_dataset


DEMOS = (
    {
        "id": "retail", "title": "Handel & Bestellungen", "name": "Handelsdaten · Demo",
        "description": "Bestellungen an drei Standorten: Umsatz, Rabatt und Lieferzeiten.",
        "grain": "Eine Zeile = eine Bestellung", "row_count": 720,
        "tags": ["Zeitverlauf", "Standortvergleich", "Extremwerte"], "seed": 42,
        "note": "Drei Standorte, zeitliche Entwicklung und einzelne stark erhöhte Umsätze.",
    },
    {
        "id": "energy", "title": "Energie & Gebäude", "name": "Gebäudetechnik · Demo",
        "description": "Tägliche Messungen von Verbrauch, Wetter und Raumklima in drei Gebäuden.",
        "grain": "Eine Zeile = ein Gebäude an einem Tag", "row_count": 540,
        "tags": ["Jahreswechsel", "Negative Werte", "Sensorlücken"], "seed": 73,
        "note": "Wetterabhängiger Verbrauch, unterschiedliche Gebäude, Verbrauchsspitzen und fehlende CO₂-Messwerte. Wiederholte Messungen je Gebäude sind keine unabhängigen Stichproben.",
    },
    {
        "id": "learning", "title": "Lernen & Kursnutzung", "name": "Lernstudie · Demo",
        "description": "Anonyme Kursbeobachtungen: Lernaufwand, Teilnahme und Testergebnisse.",
        "grain": "Eine Zeile = eine Person in einem Kurs", "row_count": 420,
        "tags": ["Ohne Zeitachse", "Kategorien", "Zusammenhänge"], "seed": 118,
        "note": "Unterschiedliche Kursformate, zusammenhängende Lern- und Testwerte, ungewöhnliche Kombinationen und fehlende Antworten. Eine Querschnittsstudie ohne zeitliche Reihenfolge; Gruppenunterschiede belegen keinen Lerneffekt.",
    },
)


def demo_catalog() -> list[dict]:
    return [{key: value for key, value in demo.items() if key not in {"seed", "note", "name"}} for demo in DEMOS]


def _retail(rng: np.random.Generator) -> pd.DataFrame:
    n = 720
    groups = rng.choice(["Dresden", "Leipzig", "Berlin"], n, p=[0.4, 0.35, 0.25])
    segments = np.array([{"Dresden": 0, "Leipzig": 1, "Berlin": 2}[g] for g in groups])
    days = rng.integers(0, 180, n)
    amount = np.maximum(12, 80 + segments * 85 + days * 0.35 + rng.normal(0, 22, n))
    units = np.maximum(1, np.round(2 + segments * 3 + rng.normal(0, 0.7, n)))
    amount[[12, 97, 312, 580]] *= 7
    frame = pd.DataFrame({
        "Bestell_ID": [f"LS-{i + 1001}" for i in range(n)],
        "Datum": (pd.Timestamp("2026-01-01") + pd.to_timedelta(days, unit="D")).strftime("%Y-%m-%d"),
        "Standort": groups, "Umsatz": np.round(amount, 2), "Artikel": units.astype(int),
        "Rabatt_Prozent": np.round(np.clip(segments * 6 + rng.normal(3, 2, n), 0, 30), 1),
        "Lieferzeit_Tage": np.round(np.clip(6 - segments * 1.5 + rng.normal(0, 0.6, n), 1, 12), 1),
        "Kanal": rng.choice(["Onlineshop", "Filiale", "Marktplatz"], n),
    })
    frame.loc[[5, 40, 101, 160, 310, 411], "Lieferzeit_Tage"] = np.nan
    return frame


def _energy(rng: np.random.Generator) -> pd.DataFrame:
    days = np.repeat(np.arange(180), 3)
    n = len(days)
    buildings = np.tile(["Bibliothek", "Labor", "Verwaltung"], 180)
    index = np.tile(np.arange(3), 180)
    dates = pd.DatetimeIndex(pd.Timestamp("2025-10-01") + pd.to_timedelta(days, unit="D"))
    outdoor = 5 + 10 * np.cos((days + 25) / 180 * np.pi) + rng.normal(0, 1.8, n)
    occupied = np.clip(65 + index * 15 - (dates.dayofweek >= 5) * 40 + rng.normal(0, 7, n), 5, 100)
    energy = 90 + index * 90 + np.maximum(0, 18 - outdoor) * (8 + index * 2) + occupied * 1.2 + rng.normal(0, 12, n)
    energy[[31, 227, 469]] *= 3.5
    co2 = 390 + occupied * 7 + index * 70 + rng.normal(0, 28, n)
    co2[358] = 2450
    frame = pd.DataFrame({
        "Messung_ID": [f"G-{i + 1:05d}" for i in range(n)],
        "Zeitpunkt": dates.strftime("%Y-%m-%d"), "Gebäude": buildings,
        "Energie_kWh": np.round(energy, 1), "Außentemperatur_C": np.round(outdoor, 1),
        "CO2_ppm": np.round(co2), "Belegung_Prozent": np.round(occupied, 1),
        "Betriebstag": np.where(dates.dayofweek < 5, "Werktag", "Wochenende"),
    })
    # A contiguous outage, rather than scattered missing entries only.
    frame.loc[(index == 1) & (days >= 75) & (days < 90), "CO2_ppm"] = np.nan
    return frame


def _learning(rng: np.random.Generator) -> pd.DataFrame:
    n = 420
    formats = rng.choice(["Selbststudium", "Livekurs", "Mentoring"], n, p=[0.5, 0.3, 0.2])
    index = np.array([{"Selbststudium": 0, "Livekurs": 1, "Mentoring": 2}[value] for value in formats])
    prior = rng.uniform(5, 85, n)
    hours = np.clip(3 + index * 2.5 + rng.normal(0, 1.5, n), 0.5, 15)
    attendance = np.clip(50 + index * 13 + hours * 2 + rng.normal(0, 8, n), 5, 100)
    score = np.clip(15 + prior * 0.42 + hours * 3.8 + rng.normal(0, 4, n), 0, 100)
    # Mismatched combinations, not just huge values outside the 0–100 scale.
    hours[[18, 203, 377]] = [13.5, 0.7, 12.8]
    prior[[18, 203, 377]] = [80, 8, 75]
    score[[18, 203, 377]] = [12, 97, 15]
    frame = pd.DataFrame({
        "Teilnahme_ID": [f"{i + 1:05d}" for i in range(n)],
        "Kursformat": formats, "Fachbereich": rng.choice(["Sprachen", "Technik", "Gestaltung", "Wirtschaft"], n),
        "Testpunkte": np.round(score, 1), "Lernstunden_Woche": np.round(hours, 1),
        "Vorwissen_Punkte": np.round(prior, 1), "Teilnahme_Prozent": np.round(attendance, 1),
        "Abgegebene_Aufgaben": np.clip(np.round(hours * 0.8 + rng.normal(0, 0.7, n)), 0, 12).astype(int),
    })
    frame.loc[rng.choice(n, 21, replace=False), "Vorwissen_Punkte"] = np.nan
    return frame


def demo_frame(kind: str, seed: int | None = None) -> pd.DataFrame:
    demo = next((item for item in DEMOS if item["id"] == kind), None)
    if demo is None:
        raise ValueError("Unbekannter Beispieldatensatz.")
    rng = np.random.default_rng(demo["seed"] if seed is None else seed)
    return {"retail": _retail, "energy": _energy, "learning": _learning}[kind](rng)


def create_demo(kind: str = "retail") -> dict:
    frame = demo_frame(kind)
    demo = next(item for item in DEMOS if item["id"] == kind)
    return save_dataset(frame, demo["name"], notices=[
        f"Synthetische Beispieldaten · {demo['grain']}. Keine realen Personen oder Messungen.",
        demo["note"],
    ])
