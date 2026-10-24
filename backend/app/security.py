"""Local browser boundary, bounded requests and spreadsheet-oriented CSV escaping."""
from __future__ import annotations

import csv
import json
import os
import secrets
import unicodedata
from urllib.parse import urlsplit

from fastapi import HTTPException
from starlette.datastructures import Headers, MutableHeaders
from starlette.responses import JSONResponse

from .data import MAX_BYTES

TOKEN_HEADER = "X-LatentSpace-Token"
UPLOAD_BODY_LIMIT = MAX_BYTES + 128 * 1024
JSON_BODY_LIMIT = 2 * 1024 * 1024


def host_name(authority):
    try:
        parsed = urlsplit(f"http://{authority}")
        _ = parsed.port
        if parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment:
            return None
        return parsed.hostname.lower() if parsed.hostname else None
    except ValueError:
        return None


class LocalBoundary:
    def __init__(self, app, token):
        self.app, self.token = app, token
        self.hosts = set(os.environ.get("LATENTSPACE_ALLOWED_HOSTS", "localhost,127.0.0.1,::1").split(","))
        self.hosts = {host.strip().lower() for host in self.hosts if host.strip()}
        if "*" in self.hosts:
            raise ValueError("LATENTSPACE_ALLOWED_HOSTS benötigt ausdrückliche Hostnamen.")
        self.origins = {value.strip() for value in os.environ.get("LATENTSPACE_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://[::1]:5173").split(",") if value.strip()}

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = Headers(scope=scope)
        authority = headers.get("host", "")
        origin = headers.get("origin")
        path = scope.get("path", "")
        is_api = path.startswith("/api/")

        async def secure_send(message):
            if message["type"] == "http.response.start":
                outgoing = MutableHeaders(scope=message)
                outgoing["X-Content-Type-Options"] = "nosniff"
                outgoing["Referrer-Policy"] = "no-referrer"
                outgoing["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
                outgoing["Vary"] = "Origin, Sec-Fetch-Site"
                if is_api:
                    outgoing["Cache-Control"] = "no-store"
            await send(message)

        async def reject(status, detail, code):
            await JSONResponse({"detail": detail, "code": code}, status_code=status)(scope, receive, secure_send)

        if len(headers.getlist("host")) != 1 or host_name(authority) not in self.hosts:
            return await reject(400, "Dieser Host ist für den lokalen Arbeitsbereich nicht freigegeben.", "LOCAL_HOST")
        if is_api:
            target = f"{scope.get('scheme', 'http')}://{authority}"
            if origin is not None and origin not in {target, *self.origins}:
                return await reject(403, "Der Ursprung der Anfrage ist nicht freigegeben.", "LOCAL_ORIGIN")
            if headers.get("sec-fetch-site") == "cross-site":
                return await reject(403, "Websiteübergreifende API-Anfragen sind nicht freigegeben.", "LOCAL_ORIGIN")
            if scope["method"] not in {"GET", "HEAD", "OPTIONS"}:
                supplied = headers.get(TOKEN_HEADER, "")
                if not secrets.compare_digest(supplied.encode("utf-8"), self.token.encode("ascii")):
                    return await reject(403, "Das lokale Sitzungstoken fehlt oder ist abgelaufen.", "LOCAL_TOKEN")
        limit = UPLOAD_BODY_LIMIT if path == "/api/datasets" and scope["method"] == "POST" else JSON_BODY_LIMIT
        lengths = headers.getlist("content-length")
        if lengths:
            try:
                size = int(lengths[0])
                if len(lengths) != 1 or size < 0:
                    raise ValueError
            except ValueError:
                return await reject(400, "Ungültige Größenangabe der Anfrage.", "BODY_LENGTH")
            if size > limit:
                return await reject(413, "Die Anfrage überschreitet die zugelassene Größe.", "BODY_LIMIT")
        consumed = 0

        async def bounded_receive():
            nonlocal consumed
            message = await receive()
            if message["type"] == "http.request":
                consumed += len(message.get("body", b""))
                if consumed > limit:
                    raise HTTPException(413, "Die Anfrage überschreitet die zugelassene Größe.")
            return message

        await self.app(scope, bounded_receive, secure_send)


def spreadsheet_text(value):
    if not isinstance(value, str):
        return value
    normalized = unicodedata.normalize("NFKC", value).lstrip(" \t\r\n\ufeff\u200b")
    if value.startswith(("\t", "\r", "\n")) or normalized.startswith(("=", "+", "-", "@")):
        # Quoted TAB prefix targets spreadsheet viewing. Original values remain
        # available in JSON; CSV has no universal cross-application text type.
        return "\t" + value
    return value


def spreadsheet_csv(frame):
    names, used, mapping = [], set(), []
    for name in frame.columns:
        exported = spreadsheet_text(str(name))
        unique = exported
        while unique in used:
            unique += "_"
        used.add(unique)
        names.append(unique)
        mapping.append({"source": str(name), "exported": unique})
    protected = frame.map(spreadsheet_text)
    return protected.to_csv(index=False, header=names, quoting=csv.QUOTE_ALL).encode("utf-8-sig"), json.dumps(mapping, ensure_ascii=True)
