from __future__ import annotations

import io
import logging
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from .analysis import AnalysisRequest, ExploreRequest, analyze, explore, prepare, public_analysis
from .data import MAX_BYTES, delete_dataset, demo_dataset, import_file, list_datasets, load_dataset, metadata

app = FastAPI(title="LatentSpace", version="0.1.0")
executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="latentspace")
jobs: dict[str, dict] = {}
lock = threading.Lock()
logger = logging.getLogger(__name__)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.1.0"}


@app.get("/api/datasets")
def datasets():
    return list_datasets()


@app.post("/api/datasets/demo", status_code=201)
def demo():
    return demo_dataset()


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
    anomaly_name = annotation_name("LatentSpace_Auffaellig")
    rows = [{**result["rows"][i]["values"], cluster_name: result["rows"][i]["cluster"], anomaly_name: result["rows"][i]["anomaly"]} for i in selected]
    frame = pd.DataFrame(rows, columns=columns).map(lambda value: "'" + value if isinstance(value, str) and value.lstrip().startswith(("=", "+", "-", "@", "\t", "\r")) else value)
    data = frame.to_csv(index=False).encode("utf-8-sig")
    return StreamingResponse(io.BytesIO(data), media_type="text/csv", headers={"Content-Disposition": 'attachment; filename="latentspace-auswahl.csv"'})


FRONTEND = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if FRONTEND.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND / "assets"), name="assets")

    @app.get("/")
    def index():
        return FileResponse(FRONTEND / "index.html")
