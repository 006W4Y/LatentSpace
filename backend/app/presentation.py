"""Explicit structural interpretations; unit labels never rescale or classify data."""
from __future__ import annotations

from typing import Literal

import numpy as np
import pandas as pd
from pydantic import BaseModel, ConfigDict, Field


class ColumnDisplay(BaseModel):
    model_config = ConfigDict(extra="forbid")
    date_format: Literal["iso", "dmy", "mdy"] | None = None
    month_base: Literal["none", "zero", "one"] = "none"
    unit_label: str = Field(default="", max_length=40)


def number_series(series: pd.Series, decimal="."):
    if pd.api.types.is_numeric_dtype(series):
        return pd.to_numeric(series, errors="coerce").replace([np.inf, -np.inf], np.nan)
    def normalize(value):
        if not isinstance(value, str):
            return value
        value = value.strip()
        return value.replace(".", "").replace(",", ".") if decimal == "," else value
    return pd.to_numeric(series.map(normalize), errors="coerce").replace([np.inf, -np.inf], np.nan)


def date_hints(series):
    text = series.dropna().astype("string")
    iso = text.str.match(r"^\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:[ Tt].*)?$")
    local = text.str.extract(r"^(\d{1,2})[./](\d{1,2})[./](\d{4})(?:[ Tt].*)?$")
    first, second = pd.to_numeric(local[0], errors="coerce"), pd.to_numeric(local[1], errors="coerce")
    has_local = first.notna().any()
    dmy_only = bool((first > 12).any())
    mdy_only = bool((second > 12).any())
    ambiguous = bool(has_local and not dmy_only and not mdy_only and ((first != second) & first.notna()).any())
    suggestion = "iso" if len(text) and iso.all() else "dmy" if has_local and not mdy_only and not ambiguous else "mdy" if has_local and not dmy_only and not ambiguous else None
    return {"date_ambiguous": ambiguous, "date_format_suggestion": suggestion, "date_shaped": bool(len(text) and (iso | first.notna()).mean() > .9)}


def column_hints(series, decimal="."):
    hints = date_hints(series)
    numbers = number_series(series, decimal).dropna()
    choices = []
    if len(numbers) and len(numbers) == series.notna().sum() and (numbers == np.floor(numbers)).all():
        if numbers.between(0, 11).all():
            choices.append("zero")
        if numbers.between(1, 12).all():
            choices.append("one")
    return {**hints, "month_choices": choices}


def date_series(series: pd.Series, date_format=None, *, legacy=False):
    text = series.astype("string")
    if legacy:
        day_first = bool(text.dropna().str.match(r"^\d{1,2}\.\d{1,2}\.\d{4}").any())
        return pd.to_datetime(text, errors="coerce", format="mixed", dayfirst=day_first, utc=True)
    hints = date_hints(series)
    if date_format is None:
        if hints["date_ambiguous"]:
            raise ValueError("Mehrdeutiges Datum: bitte Tag/Monat/Jahr oder Monat/Tag/Jahr ausdrücklich wählen.")
        date_format = hints["date_format_suggestion"]
        if date_format is None:
            raise ValueError("Bitte ein Datumsformat ausdrücklich wählen.")
    iso = text.str.extract(r"^(\d{4})[-/](\d{1,2})[-/](\d{1,2})((?:[ Tt].*)?)$")
    canonical = iso[0] + "-" + iso[1].str.zfill(2) + "-" + iso[2].str.zfill(2) + iso[3]
    if date_format in {"dmy", "mdy"}:
        local = text.str.extract(r"^(\d{1,2})[./](\d{1,2})[./](\d{4})((?:[ Tt].*)?)$")
        day, month = (local[0], local[1]) if date_format == "dmy" else (local[1], local[0])
        local_iso = local[2] + "-" + month.str.zfill(2) + "-" + day.str.zfill(2) + local[3]
        canonical = canonical.fillna(local_iso)
    return pd.to_datetime(canonical, errors="coerce", format="ISO8601", utc=True)
