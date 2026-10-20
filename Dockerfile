FROM node:24-bookworm-slim AS web
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 LATENTSPACE_DATA_DIR=/app/data NUMBA_CACHE_DIR=/tmp/numba
WORKDIR /app
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/app/ /app/backend/app/
COPY --from=web /build/frontend/dist/ /app/frontend/dist/
RUN useradd --create-home --uid 10001 latentspace && mkdir -p /app/data && chown -R latentspace:latentspace /app
USER latentspace
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health')"
CMD ["python", "-m", "uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
