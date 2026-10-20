import copy

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from backend.app.analysis import AnalysisRequest, ExploreRequest, analyze, explore
from backend.app.data import load_dataset, save_dataset
from backend.app.explanations import comparison, explain_row
from backend.app.main import app, jobs, lock
from backend.app.reports import build_report, markdown_report


@pytest.fixture(autouse=True)
def storage(tmp_path, monkeypatch):
    monkeypatch.setenv("LATENTSPACE_DATA_DIR", str(tmp_path))


def result_for(frame):
    metadata = save_dataset(frame, "werte.csv")
    return analyze(load_dataset(metadata["id"]), AnalysisRequest())


@pytest.mark.parametrize("value,direction", [(1000, "höher"), (-100, "niedriger")])
def test_value_rule_exposes_the_actual_quartile_fence_in_both_directions(value, direction):
    item = comparison("Messwert", value, list(range(90, 110)), "global", [])
    assert item["is_evidence"]
    assert item["direction"] == direction
    assert item["rule"] == "iqr"
    assert "unter 80,5 oder über 118,5" in item["criterion"]


def test_distance_rule_is_reported_when_quartiles_have_no_spread():
    item = comparison("Signal", 2, [0] * 18 + [-1, 1], "global", [])
    assert item["rule"] == "distance"
    assert item["deviation"] == pytest.approx(2 / np.std([0] * 18 + [-1, 1]))
    assert "Schwelle beträgt 3" in item["criterion"]


def test_constant_reference_and_normal_values_are_distinguished():
    constant = comparison("Signal", 100, [5] * 20, "global", [])
    assert constant["rule"] == "constant"
    assert "20 Vergleichswerte liegen bei 5" in constant["criterion"]
    ordinary = comparison("Signal", 100, list(range(90, 110)), "global", [])
    assert ordinary["is_evidence"] is False
    assert ordinary["rule"] is None and ordinary["criterion"] is None


def test_all_evidence_features_survive_pagination_and_report_without_changing_source():
    # The relevant values can lie after the first two displayed/model columns.
    frame = pd.DataFrame({f"Variable_{i}": list(np.linspace(10, 12, 60)) + [1000 + i] for i in range(8)})
    frame["Fehlender_Wert"] = list(range(60)) + [None]
    result = result_for(frame)
    original = copy.deepcopy(result["rows"])
    detail = explain_row(result, 60)
    assert result["rows"][60]["anomaly"]
    assert detail["assessment"] == "value_deviation"
    assert {reason["feature"] for reason in detail["reasons"]} == {f"Variable_{i}" for i in range(8)}
    assert all(reason["criterion"] for reason in detail["reasons"])
    assert detail["missing_features"] == ["Fehlender_Wert"]
    basic = explore(result, ExploreRequest(page=1))
    assert all("explanation" not in row for row in basic["rows"])
    page = explore(result, ExploreRequest(page=1, explain_page=True))
    last = next(row for row in page["rows"] if row["id"] == 60)
    assert last["explanation"] == detail
    filtered = explore(result, ExploreRequest(row_ids=[60], explain_page=True))
    assert filtered["rows"][0]["explanation"] == detail
    assert all("explanation" not in row for row in page["rows"] if not row["anomaly"])
    report = build_report(result, ExploreRequest(row_ids=[60]))
    assert len(report["explained_anomalies"][0]["explanation"]["reasons"]) == 8
    assert "Prüfregel:" in markdown_report(report)
    assert result["rows"] == original


def test_model_only_flags_do_not_invent_a_specific_cell():
    result = result_for(pd.DataFrame({"Signal": [1, 2, 999]}))
    # Too few leave-one-out reference values to support any single-value claim.
    result["rows"][2]["anomaly"] = True
    detail = explain_row(result, 2)
    assert detail["assessment"] == "model_only"
    assert detail["reasons"] == []
    assert "keinen belastbaren Hinweis" in detail["summary"]


def test_page_evidence_is_available_via_the_normal_exploration_endpoint():
    result = result_for(pd.DataFrame({"Signal": list(range(50)) + [1000]}))
    with lock:
        jobs["cell-evidence"] = {"id": "cell-evidence", "dataset_id": result["dataset_id"], "status": "done", "result": result}
    try:
        with TestClient(app) as client:
            response = client.post("/api/analyses/cell-evidence/explore", json={"page": 1, "explain_page": True})
            assert response.status_code == 200
            reason = response.json()["rows"][0]["explanation"]["reasons"][0]
            assert reason["feature"] == "Signal" and reason["value"] == 1000
            assert reason["rule"] == "iqr" and reason["criterion"]
    finally:
        with lock:
            jobs.pop("cell-evidence", None)
