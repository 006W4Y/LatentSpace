"""SQLite-backed analysis views, finding snapshots, and analyst notes."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from .data import connection, load_dataset


def initialize(db):
    db.execute("CREATE TABLE IF NOT EXISTS research (id TEXT PRIMARY KEY, dataset_id TEXT NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL, FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE)")


def save(dataset_id, kind, payload):
    load_dataset(dataset_id)
    record = {**payload, "id": uuid.uuid4().hex, "dataset": dataset_id, "kind": kind, "created_at": datetime.now(timezone.utc).isoformat()}
    with connection() as db:
        initialize(db)
        db.execute("INSERT INTO research VALUES (?, ?, ?, ?)", (record["id"], dataset_id, kind, json.dumps(record, ensure_ascii=False, allow_nan=False)))
    return record


def get(record_id):
    with connection() as db:
        initialize(db)
        row = db.execute("SELECT payload FROM research WHERE id = ?", (record_id,)).fetchone()
    if row is None:
        raise KeyError(record_id)
    return json.loads(row[0])


def list_for(dataset_id):
    with connection() as db:
        initialize(db)
        rows = db.execute("SELECT payload FROM research WHERE dataset_id = ? ORDER BY rowid DESC", (dataset_id,)).fetchall()
    return [{key: value for key, value in json.loads(row[0]).items() if key != "snapshot"} for row in rows]


def update(record_id, name=None, notes=None, review=None):
    with connection() as db:
        initialize(db)
        row = db.execute("SELECT payload FROM research WHERE id = ?", (record_id,)).fetchone()
        if row is None:
            raise KeyError(record_id)
        record = json.loads(row[0])
        if name is not None:
            record["name"] = name
        if notes is not None:
            record["notes"] = notes
        if review is not None:
            record["review"] = review
        record["updated_at"] = datetime.now(timezone.utc).isoformat()
        db.execute("UPDATE research SET payload = ? WHERE id = ?", (json.dumps(record, ensure_ascii=False, allow_nan=False), record_id))
    return record


def delete(record_id):
    with connection() as db:
        initialize(db)
        if not db.execute("DELETE FROM research WHERE id = ?", (record_id,)).rowcount:
            raise KeyError(record_id)


def delete_for(dataset_id):
    with connection() as db:
        initialize(db)
        db.execute("DELETE FROM research WHERE dataset_id = ?", (dataset_id,))


def restore_finding(record):
    from .analysis import AnalysisRequest, prepare
    from .findings import fingerprint
    snapshot = record["snapshot"]
    payload = load_dataset(record["dataset"])
    frame, roles, _, usable = prepare(payload, AnalysisRequest(**snapshot["analysis_config"]), legacy="display" not in snapshot["analysis_config"])
    flagged = set(snapshot.get("model_flags", []))
    result = {"dataset_id": payload["id"], "_frame": frame, "roles": roles, "_decimal": payload["decimal"], "config": snapshot["analysis_config"], "features": usable,
              "rows": [{"id": i, "values": row, "anomaly": i in flagged} for i, row in enumerate(payload["rows"])]}
    if fingerprint(result) != snapshot["fingerprint"]:
        raise ValueError("Die Originalwerte stimmen nicht mehr mit dem gespeicherten Befund überein.")
    return result, snapshot
