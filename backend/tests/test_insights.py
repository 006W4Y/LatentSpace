import copy
import hashlib
import json

import numpy as np
import pandas as pd
import pytest
from backend.tests.client import LocalClient as TestClient

from backend.app.analysis import AnalysisRequest, ExploreRequest, analyze, explore
from backend.app.data import demo_dataset, load_dataset, save_dataset
from backend.app.explanations import explain_row
from backend.app.insights import build_profile
from backend.app.main import app, jobs, lock
from backend.app.reports import build_report, markdown_report


@pytest.fixture(autouse=True)
def storage(tmp_path, monkeypatch):
    monkeypatch.setenv("LATENTSPACE_DATA_DIR", str(tmp_path))


def result_for(frame, roles=None):
    meta = save_dataset(frame, "insights.csv")
    return analyze(load_dataset(meta["id"]), AnalysisRequest(roles=roles or {}))


def test_date_distribution_uses_chronological_month_names_and_years():
    dates = pd.Series(pd.to_datetime(["2026-03-02", "2026-01-02", "2026-01-03", "2025-12-31"], utc=True))
    profile = build_profile("Datum", "date", dates)
    assert profile["distribution_kind"] == "calendar"
    assert [item["label"] for item in profile["distribution"]] == ["Dezember 2025", "Januar 2026", "Februar 2026", "März 2026"]
    assert [item["count"] for item in profile["distribution"]] == [1, 2, 0, 1]
    assert sum(item["count"] for item in profile["distribution"]) == len(dates)


def test_long_date_ranges_aggregate_by_named_year_not_index():
    dates = pd.Series(pd.to_datetime(["2020-01-01", "2026-01-01"], utc=True))
    profile = build_profile("Datum", "date", dates)
    assert profile["distribution"][0]["label"] == "2020"
    assert profile["distribution"][-1]["label"] == "2026"


@pytest.mark.parametrize("values,expected", [([0, 1, 2], ["Januar", "Februar", "März"]), ([1, 2, 12], ["Januar", "Februar", "Dezember"])])
def test_explicit_month_codes_are_named_with_visible_convention(values, expected):
    profile = build_profile("Monat", "number", pd.Series(values), {"month_base": "zero" if 0 in values else "one"})
    assert [item["label"] for item in profile["distribution"]] == expected
    assert "= Januar" in profile["distribution_note"]
    assert build_profile("Monat", "number", pd.Series([0, 12]))["distribution_kind"] != "month_codes"


def test_category_histogram_and_identifiers_have_semantic_distributions():
    numeric = build_profile("Umsatz", "number", pd.Series([1.1, 2.2, 2.2, 10.2, None]))
    assert all(" – " in item["label"] for item in numeric["distribution"])
    assert sum(item["count"] for item in numeric["distribution"]) == 4
    categories = build_profile("Kanal", "category", pd.Series(list("abcdefghij")))
    assert categories["distribution"][-1]["label"] == "Weitere (4)"
    assert sum(item["count"] for item in categories["distribution"]) == 10
    identifier = build_profile("ID", "identifier", pd.Series(["01", "02", "03"]))
    assert identifier["distribution"] == []
    assert identifier["distribution_kind"] == "identifier"


def test_discrete_counts_and_continuous_axis_labels_do_not_round_to_duplicates():
    discrete = build_profile("Artikel", "number", pd.Series([1, 2, 2, 4]))
    assert discrete["distribution_kind"] == "discrete"
    assert discrete["distribution"] == [{"label": "1", "count": 1}, {"label": "2", "count": 2}, {"label": "4", "count": 1}]
    continuous = build_profile("Tage", "number", pd.Series(np.linspace(1.1, 7.2, 100)))
    labels = [item["short_label"] for item in continuous["distribution"]]
    assert len(labels) == len(set(labels))


def test_extreme_value_is_explained_without_using_itself_as_reference():
    frame = pd.DataFrame({"Umsatz": list(range(90, 110)) + [1000]})
    result = result_for(frame)
    explanation = explain_row(result, 20)
    assert explanation["flagged"]
    reason = explanation["reasons"][0]
    assert reason["feature"] == "Umsatz"
    assert reason["value"] == 1000
    assert reason["median"] == 99.5
    assert reason["reference_n"] == 20
    assert reason["percentile"] == 100
    assert reason["kind"] == "global"
    assert "keine exakte" in explanation["limitation"]


def test_unusual_combination_can_be_explained_by_other_feature_peers():
    rng = np.random.default_rng(18)
    x = rng.uniform(-3, 3, 400)
    y = 2 * x + rng.normal(0, .1, 400)
    result = result_for(pd.DataFrame({"X": np.r_[x, 0], "Y": np.r_[y, 5]}))
    explanation = explain_row(result, 400)
    reason = next(item for item in explanation["reasons"] if item["feature"] == "Y")
    assert reason["kind"] == "context"
    assert reason["other_features"] == ["X"]
    assert abs(reason["median"]) < 1
    assert reason["value"] == 5
    assert reason["reference_n"] >= 5


def test_isolated_points_do_not_get_falsely_labeled_similar_peers():
    result = result_for(pd.DataFrame({"X": list(np.linspace(0, 1, 50)) + [100], "Y": list(np.linspace(0, 1, 50)) + [100]}))
    assert all(reason["kind"] == "global" for reason in explain_row(result, 50)["comparisons"])


def test_imputed_values_are_not_explained_as_observed_measurements():
    result = result_for(pd.DataFrame({"X": list(range(30)), "Y": [None] + list(range(1, 30))}))
    explanation = explain_row(result, 0)
    assert explanation["missing_features"] == ["Y"]
    assert all(item["feature"] != "Y" for item in explanation["comparisons"])
    assert result["rows"][0]["values"]["Y"] is None
    assert all(item["kind"] == "global" for item in explanation["comparisons"])


def test_peer_selection_does_not_rely_on_imputed_comparison_features():
    result = result_for(pd.DataFrame({"X": list(range(30)), "Y": [1, 2, 3] + [None] * 27}))
    explanation = explain_row(result, 0)
    x = next(item for item in explanation["comparisons"] if item["feature"] == "X")
    assert x["kind"] == "global"  # Only two other actually observed peer values.


def test_small_datasets_do_not_invent_explanation_evidence():
    result = result_for(pd.DataFrame({"X": [1, 2, 999]}))
    assert explain_row(result, 2)["reasons"] == []
    constant = result_for(pd.DataFrame({"X": [5, 5, 5]}))
    assert not explain_row(constant, 0)["available"]
    assert explain_row(constant, 0)["score_percentile"] is None
    with pytest.raises(KeyError):
        explain_row(result, -1)


def test_deviation_from_a_constant_reference_is_explained_without_infinite_scores():
    result = result_for(pd.DataFrame({"Wert": [5] * 20 + [100]}))
    explanation = explain_row(result, 20)
    reason = explanation["reasons"][0]
    assert reason["median"] == 5 and reason["min"] == reason["max"] == 5
    assert reason["value"] == 100
    assert reason["deviation"] is None


def test_group_findings_use_the_median_in_both_text_and_linked_view():
    result = result_for(pd.DataFrame({"Ort": ["A"] * 20 + ["B"] * 20, "Wert": list(range(20)) + list(range(100, 120))}))
    findings = explore(result, ExploreRequest())["insights"]
    finding = next(item for item in findings if item["id"] == "difference:Ort:Wert")
    assert finding["action"]["aggregation"] == "median"
    action = {k: v for k, v in finding["action"].items() if k != "view"}
    groups = explore(result, ExploreRequest(**action))["groups"]
    assert [group["value"] for group in groups] == [9.5, 109.5]


def test_temporal_findings_exclude_incomplete_boundary_months():
    dates = pd.date_range("2026-01-01", "2026-04-10", tz="UTC")
    values = [{1: 10, 2: 20, 3: 40, 4: 1000}[date.month] for date in dates]
    result = result_for(pd.DataFrame({"Datum": dates.astype(str), "Wert": values}))
    insights = explore(result, ExploreRequest())["insights"]
    trend = next(item for item in insights if item["kind"] == "trend")
    assert "März" in trend["title"]
    assert "April" not in trend["detail"]
    assert "Februar" in trend["detail"]
    assert "keine Prognose" in trend["limitation"]


def test_demo_produces_varied_evidence_and_preserves_every_original_value():
    meta = demo_dataset()
    payload = load_dataset(meta["id"])
    original = copy.deepcopy(payload["rows"])
    result = analyze(payload, AnalysisRequest())
    response = explore(result, ExploreRequest())
    assert {item["kind"] for item in response["insights"]} == {"anomaly", "relation", "group", "quality", "trend"}
    assert all(item["evidence"] and item["method"] and item["limitation"] for item in response["insights"])
    assert response["anomalies"][0]["explanation"]["reasons"]
    assert explain_row(result, 12)["reasons"][0]["feature"] == "Umsatz"
    report = build_report(result, ExploreRequest(row_ids=[12]))
    assert report["selection"]["row_ids"] == [12]
    assert report["explained_anomalies"][0]["id"] == 12
    assert "Zeile 13" in markdown_report(report)
    assert payload["rows"] == original
    assert [row["values"] for row in result["rows"]] == original
    expected = hashlib.sha256(json.dumps(original, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    assert report["dataset"]["fingerprint_sha256"] == expected


def test_explanation_reference_stays_global_when_exploration_is_filtered():
    meta = demo_dataset()
    result = analyze(load_dataset(meta["id"]), AnalysisRequest())
    before = copy.deepcopy(explain_row(result, 12))
    response = explore(result, ExploreRequest(row_ids=[12]))
    assert response["anomalies"][0]["explanation"] == before


def test_report_and_explanation_endpoints_and_stable_csv_row_reference():
    result = result_for(pd.DataFrame({"X": list(range(20)) + [999]}))
    with lock:
        jobs["insights-test"] = {"id": "insights-test", "dataset_id": result["dataset_id"], "status": "done", "result": result}
    with TestClient(app) as client:
        explanation = client.get("/api/analyses/insights-test/rows/20/explanation")
        assert explanation.status_code == 200
        assert explanation.json()["reasons"][0]["value"] == 999
        assert client.get("/api/analyses/insights-test/rows/999/explanation").status_code == 404
        report = client.post("/api/analyses/insights-test/report?format=json", json={"row_ids": [20]})
        assert report.status_code == 200
        assert report.json()["selection"]["count"] == 1
        assert report.json()["explained_anomalies"][0]["id"] == 20
        markdown = client.post("/api/analyses/insights-test/report", json={})
        assert "# LatentSpace" in markdown.text
        assert client.post("/api/analyses/insights-test/report?format=html", json={}).status_code == 422
        csv = client.post("/api/analyses/insights-test/export", json={"row_ids": [20]})
        assert "LatentSpace_Zeile" in csv.text and "LatentSpace_Anomaliescore" in csv.text
    with lock:
        jobs.pop("insights-test", None)
