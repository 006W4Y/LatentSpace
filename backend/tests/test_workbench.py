import io
import time

import numpy as np
import pandas as pd
import pytest
from backend.tests.client import LocalClient as TestClient

from backend.app.analysis import AnalysisRequest, ExploreRequest, analyze, explore
from backend.app.data import import_file, load_dataset, number_series, save_dataset
from backend.app.main import app, jobs, lock


@pytest.fixture(autouse=True)
def isolated_storage(tmp_path, monkeypatch):
    monkeypatch.setenv("LATENTSPACE_DATA_DIR", str(tmp_path))
    with lock:
        jobs.clear()
    yield


@pytest.fixture
def payload():
    rng = np.random.default_rng(10)
    values = np.r_[rng.normal(-4, .25, (40, 2)), rng.normal(4, .25, (40, 2)), [[25, -20]]]
    frame = pd.DataFrame({"Record_ID": range(81), "Datum": pd.date_range("2026-01-01", periods=81).strftime("%Y-%m-%d"), "Stadt": ["A"] * 40 + ["B"] * 41, "Umsatz": values[:, 0], "Menge": values[:, 1]})
    frame.loc[2, "Umsatz"] = np.nan
    meta = save_dataset(frame, "test.csv")
    return load_dataset(meta["id"])


@pytest.fixture
def result(payload):
    return analyze(payload, AnalysisRequest(min_cluster_size=8))


def test_german_csv_and_identifiers_remain_explicit():
    meta = import_file('Kunden_ID;Umsatz;Datum;Ort\n001;1.234,50;01.02.2026;NA\n002;;02.02.2026;Berlin\n'.encode(), "daten.csv", decimal=",")
    payload = load_dataset(meta["id"])
    roles = {c["name"]: c["role"] for c in meta["columns"]}
    assert roles == {"Kunden_ID": "identifier", "Umsatz": "number", "Datum": "date", "Ort": "category"}
    assert payload["rows"][0]["Kunden_ID"] == "001"
    assert payload["rows"][0]["Ort"] == "NA"
    result = analyze(payload, AnalysisRequest(display={"Datum":{"date_format":"dmy"}}))
    assert result["_frame"].loc[0, "Umsatz"] == 1234.5
    assert result["_frame"].loc[0, "Datum"].month == 2
    assert result["rows"][1]["values"]["Umsatz"] is None


def test_native_excel_numbers_are_not_rescaled_by_decimal_setting():
    series = pd.Series([12.5, "2,5", None], dtype=object)
    assert number_series(series, ",").iloc[:2].tolist() == [12.5, 2.5]
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        pd.DataFrame({"Wert": [12.5, 3.25, 8.5]}).to_excel(writer, index=False, sheet_name="Daten")
        pd.DataFrame({"Andere": [1]}).to_excel(writer, index=False, sheet_name="Weiteres")
    meta = import_file(buffer.getvalue(), "zahlen.xlsx", decimal=",")
    result = analyze(load_dataset(meta["id"]), AnalysisRequest())
    assert result["_frame"]["Wert"].tolist() == [12.5, 3.25, 8.5]
    assert "erste Tabellenblatt" in meta["notices"][0]


@pytest.mark.parametrize("content,filename", [(b"", "x.csv"), (b"a,a\n1,2", "x.csv"), (b"a,b\n", "x.csv"), (b"not excel", "x.xlsx"), (b"x", "x.exe")])
def test_invalid_imports_fail_without_saving(content, filename):
    with pytest.raises((ValueError, UnicodeError)):
        import_file(content, filename)


def test_csv_keeps_quoted_delimiters_and_windows_characters():
    meta = import_file('Name;Wert\n"Müller; GmbH";12\nAndere;13\n'.encode("cp1252"), "windows.csv")
    assert load_dataset(meta["id"])["rows"][0]["Name"] == "Müller; GmbH"
    assert meta["notices"]


def test_limits_reject_rather_than_silently_truncate():
    with pytest.raises(ValueError, match="höchstens"):
        import_file(("Wert\n" + "1\n" * 20_001).encode(), "large.csv")


def test_analysis_preserves_original_missing_values_and_uses_real_features(result):
    assert result["features"] == ["Umsatz", "Menge"]
    assert result["rows"][2]["values"]["Umsatz"] is None
    assert result["_frame"]["Umsatz"].isna().sum() == 1
    assert result["cluster_count"] >= 2
    assert result["rows"][-1]["anomaly"]
    assert all(np.isfinite(row["coords"]).all() for row in result["rows"])
    assert any("Median".lower() in notice.lower() for notice in result["notices"])


def test_filters_recompute_descriptions_but_preserve_model_assignments(result):
    selected = explore(result, ExploreRequest(category_column="Stadt", category_value="A", group_column="Stadt", value_column="Umsatz"))
    assert selected["count"] == 40
    assert selected["missing"] == 1
    assert selected["groups"][0]["count"] == 40
    assert all(row["cluster"] == result["rows"][row["id"]]["cluster"] for row in selected["rows"])
    assert selected["correlations"][0]["count"] == 39


def test_empty_spatial_selection_does_not_mean_all_rows(result):
    selected = explore(result, ExploreRequest(row_ids=[], date_column="Datum", value_column="Umsatz", group_column="Stadt"))
    assert selected["count"] == 0
    assert selected["filtered_ids"] == []
    assert selected["rows"] == []
    assert selected["trend"] == []


def test_search_is_literal_and_ids_are_intersected(result):
    assert explore(result, ExploreRequest(query=".*"))["count"] == 0
    assert explore(result, ExploreRequest(row_ids=[1, 1, 2, 999999], category_column="Stadt", category_value="A"))["filtered_ids"] == [1, 2]


def test_numeric_category_filter_matches_browser_serialization():
    meta = save_dataset(pd.DataFrame({"Code": [1.0, 1.0, 2.0], "Wert": [3, 4, 5]}), "codes.xlsx")
    result = analyze(load_dataset(meta["id"]), AnalysisRequest(roles={"Code": "category"}))
    assert explore(result, ExploreRequest(category_column="Code", category_value="1"))["count"] == 2
    assert explore(result, ExploreRequest(category_column="Code", category_value="1.0"))["count"] == 2


def test_trend_aggregation_and_missing_values(result):
    response = explore(result, ExploreRequest(date_column="Datum", value_column="Umsatz", period="month", aggregation="sum"))
    expected = result["_frame"].groupby(pd.Grouper(key="Datum", freq="MS"))["Umsatz"].sum(min_count=1)
    assert [r["value"] for r in response["trend"]] == pytest.approx(expected.tolist())
    counts = explore(result, ExploreRequest(date_column="Datum", period="month", aggregation="count"))
    assert sum(r["value"] for r in counts["trend"]) == 81


def test_all_missing_and_categorical_data_can_be_explored():
    meta = save_dataset(pd.DataFrame({"Kategorie": ["A", "B", "A"], "Leer": [None] * 3, "Konstant": [7] * 3}), "constant.csv")
    result = analyze(load_dataset(meta["id"]), AnalysisRequest())
    assert result["projection"] == "none"
    assert result["anomaly_count"] == 0
    assert explore(result, ExploreRequest())["missing"] == 3


def test_role_override_reports_failed_conversions():
    meta = import_file(b"Datum,Wert\n2026-01-01,10\nkaputt,unbekannt\n2026-01-03,30\n", "mixed.csv")
    result = analyze(load_dataset(meta["id"]), AnalysisRequest(roles={"Datum": "date", "Wert": "number"}, display={"Datum":{"date_format":"iso"}}))
    assert result["_frame"]["Datum"].isna().sum() == 1
    assert result["_frame"]["Wert"].isna().sum() == 1
    assert len([n for n in result["notices"] if "nicht gelesen" in n]) == 2


def test_invalid_column_and_role_requests_are_rejected(payload, result):
    for request in [AnalysisRequest(roles={"missing": "number"}), AnalysisRequest(features=["Stadt"]), AnalysisRequest(projection="other")]:
        with pytest.raises(ValueError):
            analyze(payload, request)
    for request in [ExploreRequest(date_column="Umsatz"), ExploreRequest(value_column="Stadt"), ExploreRequest(group_column="missing"), ExploreRequest(period="year")]:
        with pytest.raises(ValueError):
            explore(result, request)


def test_umap_produces_finite_coordinates_and_does_not_change_clusters(payload, result):
    projected = analyze(payload, AnalysisRequest(projection="umap", min_cluster_size=8))
    assert projected["projection"] == "umap"
    assert np.isfinite([row["coords"] for row in projected["rows"]]).all()
    assert [row["cluster"] for row in projected["rows"]] == [row["cluster"] for row in result["rows"]]


def test_api_import_job_explore_export_and_delete():
    with TestClient(app) as client:
        uploaded = client.post("/api/datasets", files={"file": ("safe.csv", b'Name,Wert\n"=1+1",1\nnormal,2\nanderer,40\n')})
        assert uploaded.status_code == 201
        dataset_id = uploaded.json()["id"]
        assert client.get("/api/datasets").json()[0]["id"] == dataset_id
        started = client.post(f"/api/datasets/{dataset_id}/analyses", json={})
        assert started.status_code == 202
        job_id = started.json()["id"]
        for _ in range(100):
            status = client.get(f"/api/analyses/{job_id}").json()["status"]
            if status in {"done", "failed"}:
                break
            time.sleep(.05)
        assert status == "done"
        assert len(client.get(f"/api/analyses/{job_id}/result").json()["rows"]) == 3
        assert client.post(f"/api/analyses/{job_id}/explore", json={"row_ids": [0]}).json()["count"] == 1
        csv = client.post(f"/api/analyses/{job_id}/export", json={"row_ids": [0]})
        assert csv.status_code == 200
        assert "\t=1+1" in csv.text
        assert "normal" not in csv.text
        empty = client.post(f"/api/analyses/{job_id}/export", json={"row_ids": []})
        assert '"Name","Wert"' in empty.text
        assert client.post(f"/api/analyses/{job_id}/explore", json={"value_column": "Name"}).status_code == 422
        assert client.delete(f"/api/datasets/{dataset_id}").status_code == 204
        assert client.get(f"/api/datasets/{dataset_id}").status_code == 404
        assert client.get(f"/api/analyses/{job_id}").status_code == 404


def test_api_errors_are_actionable():
    with TestClient(app) as client:
        assert client.post("/api/datasets", files={"file": ("bad.csv", b"")}).status_code == 422
        assert client.post("/api/datasets", files={"file": ("x.csv", b"A\n1")}, data={"decimal": "!"}).status_code == 422
        assert client.get("/api/datasets/unknown").status_code == 404
