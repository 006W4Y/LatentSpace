"""Exercise the same single-file workflow across independent data contexts."""
import copy
import json

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from backend.app.analysis import AnalysisRequest, ExploreRequest, analyze, explore
from backend.app.data import demo_dataset, import_file, list_datasets, load_dataset, save_dataset
from backend.app.demos import DEMOS, demo_frame
from backend.app.main import app
from backend.app.reports import build_report


@pytest.fixture(autouse=True)
def storage(tmp_path, monkeypatch):
    monkeypatch.setenv("LATENTSPACE_DATA_DIR", str(tmp_path))


@pytest.mark.parametrize("kind", ["retail", "energy", "learning"])
@pytest.mark.parametrize("seed", [None, 2026])
def test_different_contexts_produce_grounded_insights_through_ordinary_csv_import(kind, seed):
    # No demo flags or hand-selected analysis features go into this pipeline.
    frame = demo_frame(kind, seed=seed)
    metadata = import_file(frame.to_csv(index=False).encode(), "eigene-datei.csv")
    payload = load_dataset(metadata["id"])
    originals = copy.deepcopy(payload["rows"])
    result = analyze(payload, AnalysisRequest())
    response = explore(result, ExploreRequest())
    assert response["count"] == len(frame)
    assert result["features"]
    assert all(np.isfinite(row["coords"]).all() for row in result["rows"])
    kinds = {item["kind"] for item in response["insights"]}
    assert {"quality", "relation", "group", "anomaly"} <= kinds
    if kind == "learning":
        assert "date" not in result["roles"].values()
        assert "trend" not in kinds
        assert result["roles"]["Teilnahme_ID"] == "identifier"
        assert response["trend"] == []
    else:
        assert "date" in result["roles"].values()
        assert "trend" in kinds
    for insight in response["insights"]:
        assert insight["evidence"] and insight["method"] and insight["limitation"]
        assert all(0 <= row < len(frame) for row in insight["row_ids"])
    assert any(row["explanation"]["reasons"] for row in response["anomalies"])
    report = build_report(result, ExploreRequest())
    json.dumps(report, allow_nan=False)
    assert report["dataset"]["rows"] == len(frame)
    assert payload["rows"] == originals
    assert load_dataset(metadata["id"])["rows"] == originals
    assert [row["values"] for row in result["rows"]] == originals


@pytest.mark.parametrize("kind", ["retail", "energy", "learning"])
def test_analysis_does_not_depend_on_domain_names(kind):
    original = demo_dataset(kind)
    payload = load_dataset(original["id"])
    first = analyze(payload, AnalysisRequest())
    mapping = {column["name"]: f"Merkmal_{i}" for i, column in enumerate(payload["columns"])}
    renamed = save_dataset(pd.DataFrame(payload["rows"]).rename(columns=mapping), "unbekannter-kontext.csv")
    roles = {mapping[column["name"]]: column["role"] for column in payload["columns"]}
    second = analyze(load_dataset(renamed["id"]), AnalysisRequest(roles=roles))
    np.testing.assert_allclose([row["score"] for row in first["rows"]], [row["score"] for row in second["rows"]])
    assert [row["cluster"] for row in first["rows"]] == [row["cluster"] for row in second["rows"]]
    assert [item["kind"] for item in explore(first, ExploreRequest())["insights"]] == [item["kind"] for item in explore(second, ExploreRequest())["insights"]]


def test_energy_preserves_negative_measurements_calendar_order_and_sensor_gap():
    meta = demo_dataset("energy")
    result = analyze(load_dataset(meta["id"]), AnalysisRequest())
    response = explore(result, ExploreRequest(date_column="Zeitpunkt", value_column="Außentemperatur_C", group_column="Gebäude"))
    assert min(row["values"]["Außentemperatur_C"] for row in result["rows"]) < 0
    co2 = next(profile for profile in response["profiles"] if profile["name"] == "CO2_ppm")
    assert co2["missing"] == 15
    assert co2["observed"] == 525
    calendar = next(profile for profile in response["profiles"] if profile["name"] == "Zeitpunkt")
    assert calendar["distribution"][0]["label"] == "Oktober 2025"
    assert calendar["distribution"][-1]["label"] == "März 2026"
    frame = pd.DataFrame(load_dataset(meta["id"])["rows"])
    frame["Zeitpunkt"] = pd.to_datetime(frame["Zeitpunkt"])
    expected = frame.groupby(frame["Zeitpunkt"].dt.to_period("M"))["Außentemperatur_C"].mean()
    # Temperature is averaged by default, not added across all buildings/days.
    assert [point["value"] for point in response["trend"]] == pytest.approx(expected.tolist())
    for group in response["groups"]:
        assert group["value"] == pytest.approx(frame.loc[frame["Gebäude"] == group["label"], "Außentemperatur_C"].mean())


def test_catalog_and_api_create_separate_single_file_examples_without_changing_default():
    with TestClient(app) as client:
        catalog = client.get("/api/demos").json()
        assert [item["id"] for item in catalog] == ["retail", "energy", "learning"]
        ids = []
        for demo in catalog:
            response = client.post(f"/api/datasets/demo?kind={demo['id']}")
            assert response.status_code == 201
            data = response.json()
            assert data["row_count"] == demo["row_count"]
            assert any(demo["grain"] in note for note in data["notices"])
            assert "Synthetische" in data["notices"][0]
            ids.append(data["id"])
        assert len(set(ids)) == 3
        assert client.post("/api/datasets/demo").json()["name"] == DEMOS[0]["name"]
        assert client.post("/api/datasets/demo?kind=unknown").status_code == 422
        assert len(list_datasets()) == 4


def test_unknown_demo_cannot_create_a_dataset():
    with pytest.raises(ValueError, match="Unbekannter"):
        demo_dataset("unknown")
    assert list_datasets() == []
