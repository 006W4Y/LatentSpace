import copy
import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from backend.tests.client import LocalClient as TestClient

from backend.app.analysis import AnalysisRequest, ExploreRequest, analyze, explore
from backend.app.data import connection, import_file, load_dataset, save_dataset
from backend.app.findings import finding_report, investigate, require_finding
from backend.app.main import app, jobs, lock


@pytest.fixture(autouse=True)
def storage(tmp_path, monkeypatch):
    monkeypatch.setenv("LATENTSPACE_DATA_DIR", str(tmp_path))


def analyze_frame(frame, roles=None):
    meta = save_dataset(frame, "eigene-datei.csv")
    return analyze(load_dataset(meta["id"]), AnalysisRequest(roles=roles or {}))


def find(response, prefix):
    return next(item for item in response["insights"] if item["id"].startswith(prefix))


def test_group_discoveries_are_invariant_to_column_order_and_include_eleventh_measure():
    frame = pd.DataFrame({**{f"Nuisance_{i:02}": [5] * 160 for i in range(10)}, "Z_Signal": np.r_[np.linspace(0, 1, 80), np.linspace(100, 101, 80)], "Gruppe": ["A"]*80 + ["B"]*80})
    first = explore(analyze_frame(frame), ExploreRequest())
    second = explore(analyze_frame(frame[list(reversed(frame.columns))]), ExploreRequest())
    assert find(first, "difference:Gruppe:Z_Signal")
    assert [item["id"] for item in first["insights"]] == [item["id"] for item in second["insights"]]
    assert first["coverage"]["numeric_columns"] == 11
    assert first["coverage"]["group_measure_pairs"] == 11


def test_temporal_discovery_checks_late_measure_and_third_date_column():
    dates = pd.date_range("2026-01-01", "2026-03-31")
    frame = pd.DataFrame({**{f"Measure_{i}": np.ones(len(dates)) for i in range(10)}, "Z_Signal": np.where(dates.month == 1, 10., 100.), "A_Date": ["2026-01-01"]*len(dates), "B_Date": ["2026-01-01"]*len(dates), "Z_Date": dates.astype(str)})
    first = explore(analyze_frame(frame), ExploreRequest())
    second = explore(analyze_frame(frame[list(reversed(frame.columns))]), ExploreRequest())
    assert find(first, "time:Z_Date:Z_Signal")
    assert [item["id"] for item in first["insights"]] == [item["id"] for item in second["insights"]]
    assert first["coverage"]["date_columns"] == 3


def test_sparse_strong_correlations_do_not_evict_a_supported_relationship():
    rng = np.random.default_rng(12)
    x = rng.normal(size=200)
    frame = pd.DataFrame({**{f"Sparse_{i}": [0, 1, 2, 3, 4] + [None]*195 for i in range(5)}, "X": x, "Y": x + rng.normal(0,.5,200)})
    response = explore(analyze_frame(frame), ExploreRequest())
    assert response["correlations"][0]["count"] == 5
    relationship = find(response, "correlation:X:Y")
    assert relationship["columns"] == ["X", "Y"]
    assert response["coverage"]["eligible_correlations"] >= 1


def local_outlier_result():
    frame = pd.DataFrame({"Messwert": np.r_[np.linspace(10,11,80), [20,21,22], np.linspace(1000,1200,80)], "Gruppe": ["A"]*83+["B"]*80})
    result = analyze_frame(frame)
    for row in result["rows"]:
        row["anomaly"] = False  # A finding must never depend on this separate classifier.
    return result


def test_unmarked_cells_keep_their_filtered_quartile_reference_after_new_filters():
    result = local_outlier_result()
    originals = copy.deepcopy(result["rows"])
    response = explore(result, ExploreRequest(category_column="Gruppe", category_value="A"))
    finding = find(response, "range:Messwert")
    assert finding["row_ids"] == [80,81,82]
    assert finding["cell_evidence"][0]["upper"] < 20
    explore(result, ExploreRequest(category_column="Gruppe", category_value="B"))
    snapshot = require_finding(result, finding["token"])
    detail = investigate(result, snapshot)
    assert detail["reference_count"] == 83
    assert detail["comparison_count"] == 80
    assert len(detail["rows"]) == 3
    assert all(not row["anomaly"] and "Messwert" in row["finding_evidence"] for row in detail["rows"])
    assert detail["summaries"][0]["median"] < 11
    assert len(investigate(result, snapshot, mode="comparison")["rows"]) == 50
    assert investigate(result, snapshot, mode="comparison", page=1)["count"] == 80
    report = finding_report(result, snapshot)
    assert report["source_filters"]["category_value"] == "A"
    assert len(report["reference_row_ids"]) == 83
    assert [row["source_row"] for row in report["rows"]] == [81,82,83]
    assert result["rows"] == originals


def test_missingness_is_localized_to_category_and_month():
    dates = pd.date_range("2026-01-01", "2026-03-31")
    frame = pd.DataFrame({"Datum": np.repeat(dates.astype(str),2), "Gebäude": ["A","B"]*len(dates), "Sensor": 1.})
    frame.loc[(pd.to_datetime(frame["Datum"]).dt.month == 2) & (frame["Gebäude"] == "B"), "Sensor"] = None
    result = analyze_frame(frame)
    response = explore(result, ExploreRequest())
    pattern = next(item for item in response["insights"] if item["id"].startswith("missing_pattern") and "Februar 2026" in item["title"] and "B" in item["title"])
    assert len(pattern["row_ids"]) == 28
    assert set(pattern["columns"]) == {"Sensor", "Gebäude", "Datum"}
    assert pattern["cell_evidence"][0]["kind"] == "missing"
    detail = investigate(result, require_finding(result,pattern["token"]))
    assert all(row["values"]["Sensor"] is None for row in detail["rows"])


def test_explicit_composite_duplicate_keys_exclude_incomplete_keys_and_preserve_leading_zero():
    result = analyze_frame(pd.DataFrame({"Kunden_ID": ["001","001","002",None], "Datum": ["2026-01-01"]*4, "Wert": [5,6,7,8]}))
    assert not any(item["id"].startswith("key_duplicates") for item in explore(result,ExploreRequest())["insights"])
    response = explore(result, ExploreRequest(duplicate_keys=["Kunden_ID","Datum"]))
    finding = find(response,"key_duplicates")
    assert finding["row_ids"] == [0,1]
    assert len(finding["cell_evidence"]) == 2
    assert result["rows"][0]["values"]["Kunden_ID"] == "001"
    assert "1 Zeilen mit unvollständigem" in finding["detail"]
    with pytest.raises(ValueError):
        explore(result, ExploreRequest(duplicate_keys=["nicht-vorhanden"]))


def test_stratification_reveals_an_obscured_same_direction_relationship():
    local = np.linspace(-1,1,200)
    group = np.r_[np.full(200,-2.),np.full(200,2.)]
    x = np.tile(local,2) + group
    y = x - group*(1 + np.var(local)/4)
    result = analyze_frame(pd.DataFrame({"X": x,"Y": y,"Gruppe": ["A"]*200+["B"]*200}))
    finding = find(explore(result, ExploreRequest()), "within_groups")
    assert abs(finding["comparison_groups"][0]["correlation"]) < .01
    assert all(group["correlation"] > .99 for group in finding["comparison_groups"][1:])
    detail = investigate(result, require_finding(result,finding["token"]))
    assert {point["group"] for point in detail["scatter"]} == {"A","B"}


def test_redundancy_and_relationship_sensitivity_have_observed_support():
    x = np.linspace(0,1,100)
    redundancy = find(explore(analyze_frame(pd.DataFrame({"X":x,"Y":2*x+3})),ExploreRequest()),"redundancy")
    assert redundancy["columns"] == ["X","Y"]
    rng = np.random.default_rng(71)
    frame = pd.DataFrame({"X": np.r_[rng.normal(size=300),[100,110,120]],"Y":np.r_[rng.normal(size=300),[100,110,120]]})
    sensitive = find(explore(analyze_frame(frame),ExploreRequest()),"sensitivity")
    assert set(sensitive["row_ids"]) == {300,301,302}
    assert abs(sensitive["comparison_groups"][1]["correlation"]) < .2


def test_rare_category_combination_does_not_require_numerical_measurements():
    frame = pd.DataFrame({"Kategorie_A": ["A"]*499+["B"]*499+["A","B"],"Kategorie_B":["A"]*499+["B"]*499+["B","A"]})
    result = analyze_frame(frame)
    finding = find(explore(result,ExploreRequest()),"rare_combination")
    assert len(finding["row_ids"]) == 1
    assert finding["cell_evidence"][0]["kind"] == "combination"
    assert result["projection"] == "none"


@pytest.mark.parametrize("seed",[0,19,42])
def test_independent_random_controls_do_not_create_strong_structured_diagnoses(seed):
    rng = np.random.default_rng(seed)
    frame = pd.DataFrame({f"M{i}": rng.normal(size=1500) for i in range(4)})
    frame["Gruppe"] = rng.choice(["A","B"],len(frame))
    frame["Datum"] = (pd.Timestamp("2026-01-01") + pd.to_timedelta(rng.integers(0,365,len(frame)),unit="D")).astype(str)
    frame.loc[rng.random(len(frame)) < .1, "M0"] = None
    response = explore(analyze_frame(frame),ExploreRequest())
    # Quartile and model flags are expected in normal samples. They are not
    # evidence of planted structure; stronger diagnostics must stay absent.
    prefixes = {item["id"].split(":")[0] for item in response["insights"]}
    assert not prefixes & {"within_groups","redundancy","sensitivity","rare_combination","missing_pattern"}
    assert response["coverage"]["columns_checked"] == len(frame.columns)


def test_saved_findings_notes_and_analysis_states_survive_job_loss_and_export_full_evidence():
    result = local_outlier_result()
    response = explore(result, ExploreRequest(category_column="Gruppe",category_value="A"))
    finding = find(response,"range:Messwert")
    with lock:
        jobs["research-test"] = {"id":"research-test","dataset_id":result["dataset_id"],"status":"done","result":result}
    with TestClient(app) as client:
        detail = client.post(f"/api/analyses/research-test/findings/{finding['token']}/investigate",json={})
        assert detail.status_code == 200
        saved = client.post(f"/api/analyses/research-test/findings/{finding['token']}/save",json={"name":"Prüfung A","notes":"Mit Fachbereich abgleichen"})
        assert saved.status_code == 201
        saved_id = saved.json()["id"]
        session = client.post("/api/analyses/research-test/sessions",json={"name":"Analyse A","config":{"category_column":"Gruppe","category_value":"A","duplicate_keys":["Gruppe"]},"view":"insights"})
        assert session.status_code == 201
        assert session.json()["analysis_config"]["roles"] == result["roles"]
        with lock:
            jobs.pop("research-test")  # Server restart / bounded job eviction.
        restored = client.post(f"/api/research/{saved_id}/investigate",json={}).json()
        assert restored["reference_count"] == 83 and len(restored["rows"]) == 3
        assert restored["notes"] == "Mit Fachbereich abgleichen"
        assert restored["saved_name"] == "Prüfung A"
        assert client.patch(f"/api/research/{saved_id}",json={"notes":"Geprüft"}).status_code == 200
        exported = client.post(f"/api/research/{saved_id}/report").json()
        assert exported["notes"] == "Geprüft"
        assert len(exported["rows"]) == 3 and len(exported["reference_row_ids"]) == 83
        records = client.get(f"/api/datasets/{result['dataset_id']}/research").json()
        assert {item["kind"] for item in records} == {"finding","session"}
        assert all("snapshot" not in item for item in records)
        assert client.post(f"/api/research/{saved_id}/investigate",json={"column":"nicht-vorhanden"}).status_code == 422
        assert client.post("/api/analyses/absent/findings/unknown/investigate",json={}).status_code == 404
        assert client.delete(f"/api/datasets/{result['dataset_id']}").status_code == 204
        assert client.post(f"/api/research/{saved_id}/investigate",json={}).status_code == 404


def test_real_iris_csv_uses_the_same_import_and_investigation_pipeline():
    source = Path(__file__).parent / "fixtures" / "iris.csv"
    metadata = import_file(source.read_bytes(), source.name)
    payload = load_dataset(metadata["id"])
    originals = copy.deepcopy(payload["rows"])
    result = analyze(payload, AnalysisRequest())
    response = explore(result, ExploreRequest())
    assert metadata["row_count"] == 150
    assert result["roles"]["Species"] == "category"
    finding = next(item for item in response["insights"] if item["id"].startswith("difference:Species:"))
    investigation = investigate(result, require_finding(result, finding["token"]))
    assert len(investigation["comparison_groups"]) == 3
    assert all(group["count"] == 50 for group in investigation["comparison_groups"])
    assert payload["rows"] == originals
    assert [row["values"] for row in result["rows"]] == originals


def test_empty_selection_has_explicit_diagnostic_coverage():
    result = analyze_frame(pd.DataFrame({"X": range(30), "Kategorie": ["A"]*30}))
    response = explore(result, ExploreRequest(row_ids=[], duplicate_keys=["Kategorie"]))
    assert response["insights"] == []
    assert response["coverage"]["candidates"] == 0
    assert response["coverage"]["numeric_pairs_tested"] == 0
    assert response["coverage"]["duplicate_check"]["complete"] == 0
    assert "Leere Auswahl" in response["coverage"]["note"]


def test_export_contains_all_finding_rows_beyond_the_table_page():
    result = analyze_frame(pd.DataFrame({"Record_ID": ["SAME"]*75 + ["UNIQUE"]}))
    finding = find(explore(result, ExploreRequest(duplicate_keys=["Record_ID"])), "key_duplicates")
    snapshot = require_finding(result, finding["token"])
    assert len(investigate(result, snapshot)["rows"]) == 50
    assert len(investigate(result, snapshot, page=1)["rows"]) == 25
    report = finding_report(result, snapshot)
    assert len(report["rows"]) == 75
    assert report["rows"][-1]["source_row"] == 75
    assert report["rows"][-1]["values"]["Record_ID"] == "SAME"


def test_a_saved_finding_rejects_a_changed_source_fingerprint():
    from backend.app import research
    result = local_outlier_result()
    finding = find(explore(result, ExploreRequest(category_column="Gruppe", category_value="A")), "range:Messwert")
    record = research.save(result["dataset_id"], "finding", {"name": "Feste Basis", "notes": "", "snapshot": require_finding(result, finding["token"])})
    payload = load_dataset(result["dataset_id"])
    payload["rows"][80]["Messwert"] = 99999
    with connection() as db:
        db.execute("UPDATE datasets SET payload = ? WHERE id = ?", (json.dumps(payload), result["dataset_id"]))
    with pytest.raises(ValueError, match="Originalwerte"):
        research.restore_finding(research.get(record["id"]))
