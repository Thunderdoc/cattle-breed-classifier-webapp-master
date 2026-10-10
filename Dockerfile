# ── Stage 1: build the React front-end ────────────────────────────────────
FROM node:22-alpine AS frontend
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ── Stage 2: python runtime ───────────────────────────────────────────────
FROM python:3.11-slim AS runtime
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1
WORKDIR /srv

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install -r requirements.txt

# Optional: include torch for real inference (image grows ~2 GB).
# Build with:  docker build --build-arg WITH_TORCH=1 .
ARG WITH_TORCH=0
COPY requirements-ml.txt ./
RUN if [ "$WITH_TORCH" = "1" ]; then pip install -r requirements-ml.txt; fi

COPY . .
COPY --from=frontend /build/static/app ./static/app

RUN useradd --create-home --shell /usr/sbin/nologin appuser \
    && chown -R appuser:appuser /srv
USER appuser

EXPOSE 5001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:5001/health').status==200 else 1)"

CMD ["gunicorn", "-c", "gunicorn_conf.py", "app:app"]
