from __future__ import annotations

import io
import logging
import threading
import time
import uuid
import secrets
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Literal
from pydantic import BaseModel, Field

import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from .analysis import AnalysisRequest, ExploreRequest, analyze, explore, prepare, public_analysis
from .data import MAX_BYTES, delete_dataset, demo_dataset, import_file, list_datasets, load_dataset, metadata
from .demos import demo_catalog
from .explanations import explain_row
from .reports import build_report, markdown_report
from .findings import require_finding, investigate, finding_report
from . import research
from .security import LocalBoundary, spreadsheet_csv

app = FastAPI(title="LatentSpace", version="0.4.0")
local_token = secrets.token_urlsafe(32)
app.add_middleware(LocalBoundary, token=local_token)
executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="latentspace")
jobs: dict[str, dict] = {}
lock = threading.Lock()
logger = logging.getLogger(__name__)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.4.0"}


@app.get("/api/session")
def local_session():
    return {"token": local_token, "version": "0.4.0"}


@app.get("/api/datasets")
def datasets():
    return list_datasets()


@app.get("/api/demos")
def demos():
    return demo_catalog()


@app.post("/api/datasets/demo", status_code=201)
def demo(kind: Literal["retail", "energy", "learning"] = "retail"):
    return demo_dataset(kind)


@app.post("/api/datasets", status_code=201)
async def upload(file: UploadFile = File(...), decimal: str = Form(".")):
    if decimal not in {".", ","}:
        raise HTTPException(422, "Dezimaltrennzeichen muss Punkt oder Komma sein.")
    content = await file.read(MAX_BYTES + 1)
    try:
        return import_file(content, file.filename or "daten.csv", decimal)
    except (ValueError, UnicodeError) as exc:
        raise HTTPException(422, str(exc)) from exc


def require_dataset(dataset_id: str):
    try:
        return load_dataset(dataset_id)
    except KeyError as exc:
        raise HTTPException(404, "Datensatz nicht gefunden.") from exc


@app.get("/api/datasets/{dataset_id}")
def dataset(dataset_id: str):
    return metadata(require_dataset(dataset_id))


@app.delete("/api/datasets/{dataset_id}", status_code=204)
def remove(dataset_id: str):
    with lock:
        if any(job["dataset_id"] == dataset_id and job["status"] in {"queued", "running"} for job in jobs.values()):
            raise HTTPException(409, "Bitte die laufende Analyse abwarten.")
        try:
            delete_dataset(dataset_id)
            research.delete_for(dataset_id)
        except KeyError as exc:
            raise HTTPException(404, "Datensatz nicht gefunden.") from exc
        for job_id in [key for key, job in jobs.items() if job["dataset_id"] == dataset_id]:
            del jobs[job_id]


def run_job(job_id: str, payload: dict, request: AnalysisRequest):
    with lock:
        jobs[job_id]["status"] = "running"
    try:
        result = analyze(payload, request)
        with lock:
            jobs[job_id].update(status="done", result=result)
    except Exception:
        logger.exception("Analysis %s failed", job_id)
        with lock:
            jobs[job_id].update(status="failed", error="Die Analyse konnte nicht abgeschlossen werden. Bitte Merkmale prüfen und erneut versuchen.")


@app.post("/api/datasets/{dataset_id}/analyses", status_code=202)
def start_analysis(dataset_id: str, request: AnalysisRequest):
    payload = require_dataset(dataset_id)
    try:
        prepare(payload, request)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    with lock:
        if sum(job["status"] in {"queued", "running"} for job in jobs.values()) >= 4:
            raise HTTPException(429, "Es laufen bereits mehrere Analysen. Bitte kurz warten.")
        completed = [key for key, job in jobs.items() if job["status"] in {"done", "failed"}]
        while len(jobs) >= 8 and completed:
            del jobs[completed.pop(0)]
        job_id = uuid.uuid4().hex
        jobs[job_id] = {"id": job_id, "dataset_id": dataset_id, "status": "queued", "created_at": time.time()}
    executor.submit(run_job, job_id, payload, request)
    return {"id": job_id, "status": "queued"}


def require_job(job_id: str, done: bool = False):
    with lock:
        job = jobs.get(job_id)
        if job is None:
            raise HTTPException(404, "Analyse nicht gefunden. Bitte nach einem Neustart erneut berechnen.")
        snapshot = dict(job)
    if done and snapshot["status"] != "done":
        raise HTTPException(409, "Die Analyse ist noch nicht verfügbar.")
    return snapshot


@app.get("/api/analyses/{job_id}")
def analysis_status(job_id: str):
    return {key: value for key, value in require_job(job_id).items() if key != "result"}


@app.get("/api/analyses/{job_id}/result")
def analysis_result(job_id: str):
    return public_analysis(require_job(job_id, done=True)["result"])


@app.post("/api/analyses/{job_id}/explore")
def exploration(job_id: str, request: ExploreRequest):
    try:
        return explore(require_job(job_id, done=True)["result"], request)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@app.post("/api/analyses/{job_id}/export")
def export(job_id: str, request: ExploreRequest):
    result = require_job(job_id, done=True)["result"]
    try:
        selected = explore(result, request)["filtered_ids"]
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    # Spreadsheet formula injection protection for user-provided text values.
    columns = list(result["roles"])
    def annotation_name(base):
        name = base
        while name in columns:
            name += "_"
        columns.append(name)
        return name
    cluster_name = annotation_name("LatentSpace_Cluster")
    anomaly_name = annotation_name("LatentSpace_Modellmarkierung")
    row_name = annotation_name("LatentSpace_Zeile")
    score_name = annotation_name("LatentSpace_Anomaliescore")
    rows = [{**result["rows"][i]["values"], cluster_name: result["rows"][i]["cluster"], anomaly_name: result["rows"][i]["anomaly"], row_name: i + 1, score_name: result["rows"][i]["score"]} for i in selected]
    data, _ = spreadsheet_csv(pd.DataFrame(rows, columns=columns))
    return StreamingResponse(io.BytesIO(data), media_type="text/csv", headers={"Content-Disposition": 'attachment; filename="latentspace-auswahl.csv"', "X-LatentSpace-CSV-Protection": "quoted-tab-prefix"})


@app.get("/api/analyses/{job_id}/rows/{row_id}/explanation")
def row_explanation(job_id: str, row_id: int):
    try:
        return explain_row(require_job(job_id, done=True)["result"], row_id)
    except KeyError as exc:
        raise HTTPException(404, "Datenzeile nicht gefunden.") from exc


@app.post("/api/analyses/{job_id}/report")
def report(job_id: str, request: ExploreRequest, format: str = "markdown"):
    if format not in {"markdown", "json"}:
        raise HTTPException(422, "Bitte Markdown oder JSON als Berichtsformat wählen.")
    try:
        data = build_report(require_job(job_id, done=True)["result"], request)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    if format == "json":
        return JSONResponse(data, headers={"Content-Disposition": 'attachment; filename="latentspace-insights.json"'})
    return StreamingResponse(io.BytesIO(markdown_report(data).encode("utf-8")), media_type="text/markdown", headers={"Content-Disposition": 'attachment; filename="latentspace-insights.md"'})


class ReviewOptions(BaseModel):
    column: str | None = None
    exclude_rows: list[int] = Field(default_factory=list, max_length=50)


class InvestigationRequest(BaseModel):
    mode: Literal["affected", "comparison", "reference"] = "affected"
    page: int = Field(default=0, ge=0, le=400)
    column: str | None = None


    exclude_rows: list[int] | None = Field(default=None, max_length=50)


class SaveFindingRequest(BaseModel):
    review: ReviewOptions = Field(default_factory=ReviewOptions)
    name: str | None = Field(default=None, min_length=1, max_length=300)
    notes: str = Field(default="", max_length=10000)


class EditResearchRequest(BaseModel):
    review: ReviewOptions | None = None
    name: str | None = Field(default=None, min_length=1, max_length=300)
    notes: str | None = Field(default=None, max_length=10000)


class SaveSessionRequest(BaseModel):
    name: str = Field(min_length=1, max_length=300)
    config: ExploreRequest
    view: Literal["overview", "insights", "trends", "groups", "anomalies", "relations", "landscape", "data"]


def research_error(exc):
    return HTTPException(404 if isinstance(exc, KeyError) else 422, str(exc).strip("'"))


@app.post("/api/analyses/{job_id}/findings/{token}/investigate")
def finding_investigation(job_id: str, token: str, request: InvestigationRequest):
    try:
        result = require_job(job_id, done=True)["result"]
        return investigate(result, require_finding(result, token), **request.model_dump())
    except (KeyError, ValueError) as exc:
        raise research_error(exc) from exc


@app.post("/api/analyses/{job_id}/findings/{token}/save", status_code=201)
def save_finding(job_id: str, token: str, request: SaveFindingRequest):
    try:
        result = require_job(job_id, done=True)["result"]
        snapshot = require_finding(result, token)
        investigate(result, snapshot, **request.review.model_dump())
        return research.save(result["dataset_id"], "finding", {"name": request.name or snapshot["finding"]["title"], "notes": request.notes, "notes_origin": "user", "review": request.review.model_dump(), "snapshot": snapshot})
    except (KeyError, ValueError) as exc:
        raise research_error(exc) from exc


@app.post("/api/analyses/{job_id}/sessions", status_code=201)
def save_session(job_id: str, request: SaveSessionRequest):
    try:
        result = require_job(job_id, done=True)["result"]
        explore(result, request.config)  # Validate filters and column roles before persisting.
        return research.save(result["dataset_id"], "session", {"name": request.name, "config": request.config.model_dump(), "view": request.view,
                             "analysis_config": {**result["config"], "roles": result["roles"]}, "notes": "", "versions": result["versions"]})
    except (KeyError, ValueError) as exc:
        raise research_error(exc) from exc


@app.get("/api/datasets/{dataset_id}/research")
def list_research(dataset_id: str):
    require_dataset(dataset_id)
    return research.list_for(dataset_id)


@app.patch("/api/research/{record_id}")
def edit_research(record_id: str, request: EditResearchRequest):
    try:
        if request.review is not None:
            record = research.get(record_id)
            if record["kind"] != "finding":
                raise ValueError("Auslassvergleiche sind nur für Befunde verfügbar.")
            result, snapshot = research.restore_finding(record)
            investigate(result, snapshot, **request.review.model_dump())
        return research.update(record_id, **request.model_dump())
    except (KeyError, ValueError) as exc:
        raise research_error(exc) from exc


@app.delete("/api/research/{record_id}", status_code=204)
def delete_research(record_id: str):
    try:
        research.delete(record_id)
    except KeyError as exc:
        raise research_error(exc) from exc


@app.post("/api/research/{record_id}/investigate")
def saved_investigation(record_id: str, request: InvestigationRequest):
    try:
        record = research.get(record_id)
        if record["kind"] != "finding":
            raise ValueError("Dieser Eintrag ist eine Analyseansicht, kein Befund.")
        result, snapshot = research.restore_finding(record)
        options = request.model_dump()
        if options["exclude_rows"] is None:
            options["exclude_rows"] = record.get("review", {}).get("exclude_rows", [])
        if options["column"] is None:
            options["column"] = record.get("review", {}).get("column")
        return {**investigate(result, snapshot, **options), "saved_id": record_id, "notes": record.get("notes", ""), "saved_name": record["name"]}
    except (KeyError, ValueError) as exc:
        raise research_error(exc) from exc


@app.post("/api/analyses/{job_id}/findings/{token}/report")
def export_finding(job_id: str, token: str, request: EditResearchRequest | None = None):
    request = request or EditResearchRequest()
    try:
        result = require_job(job_id, done=True)["result"]
        return JSONResponse({**finding_report(result, require_finding(result, token), request.notes or "", request.review.model_dump() if request.review else None), "name": request.name})
    except (KeyError, ValueError) as exc:
        raise research_error(exc) from exc


@app.post("/api/research/{record_id}/report")
def export_saved_finding(record_id: str, request: EditResearchRequest | None = None):
    request = request or EditResearchRequest()
    try:
        record = research.get(record_id)
        if record["kind"] != "finding":
            raise ValueError("Dieser Eintrag ist kein Befund.")
        result, snapshot = research.restore_finding(record)
        return JSONResponse({**finding_report(result, snapshot, request.notes if request.notes is not None else record.get("notes", ""), request.review.model_dump() if request.review else record.get("review")), "name": request.name or record["name"]})
    except (KeyError, ValueError) as exc:
        raise research_error(exc) from exc


FRONTEND = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if FRONTEND.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND / "assets"), name="assets")

    @app.get("/")
    def index():
        return FileResponse(FRONTEND / "index.html")
