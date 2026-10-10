"""Flask application factory: SPA serving, security headers, CORS, errors."""

from __future__ import annotations

import logging
import time
import uuid
from pathlib import Path

from flask import Flask, Response, jsonify, request, send_from_directory

from . import metrics
from .api import api
from .config import FRONTEND_DIST, STATIC_DIR, settings

logger = logging.getLogger("cattle-classifier.factory")

CSP = (
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: blob:; "
    "font-src 'self'; "
    "connect-src 'self'; "
    "media-src 'self' blob:; "
    "object-src 'none'; "
    "base-uri 'self'; "
    "form-action 'self'; "
    "frame-ancestors *"
)


def _spa_index() -> Path:
    return FRONTEND_DIST / "index.html"


def create_app() -> Flask:
    app = Flask(__name__, static_folder=str(STATIC_DIR), static_url_path="/static")
    app.config["MAX_CONTENT_LENGTH"] = settings.max_file_size_mb * 1024 * 1024
    app.config["JSON_SORT_KEYS"] = False
    app.register_blueprint(api)

    # ------------------------------------------------------------------ hooks
    @app.before_request
    def _start_timer():
        request.request_id = uuid.uuid4().hex[:12]
        request.started_at = time.perf_counter()
        metrics.inc("requests_total")

    @app.after_request
    def _finalize(response: Response) -> Response:
        # Security headers
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        response.headers.setdefault("Content-Security-Policy", CSP)
        response.headers["X-Request-Id"] = getattr(request, "request_id", "-")

        path = request.path
        if path.startswith("/api/"):
            # CORS for the public JSON API
            origins = settings.allowed_origins
            origin = request.headers.get("Origin", "")
            if "*" in origins:
                response.headers["Access-Control-Allow-Origin"] = "*"
            elif origin and origin in origins:
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers.add("Vary", "Origin")
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            response.headers["Cache-Control"] = "no-store"
        elif path.startswith("/assets/") or path.startswith("/static/app/assets/"):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        elif path.startswith("/static/"):
            response.headers["Cache-Control"] = "public, max-age=86400"
        else:
            response.headers["Cache-Control"] = "no-cache"

        if request.method != "GET" or path.startswith(("/api/", "/health", "/ready", "/metrics")):
            return response
        elapsed = (time.perf_counter() - getattr(request, "started_at", time.perf_counter())) * 1000
        response.headers["Server-Timing"] = f"app;dur={elapsed:.1f}"
        return response

    @app.errorhandler(404)
    def _not_found(exc):
        if request.path.startswith("/api/"):
            return jsonify({"error": "Endpoint not found", "code": "not_found", "path": request.path}), 404
        return _serve_spa(404)

    @app.errorhandler(413)
    def _too_large(exc):
        return (
            jsonify(
                {
                    "error": f"Upload exceeds the {settings.max_file_size_mb} MB limit.",
                    "code": "payload_too_large",
                }
            ),
            413,
        )

    @app.errorhandler(500)
    def _server_error(exc):
        logger.exception("Unhandled server error")
        return (
            jsonify({"error": "Internal server error", "code": "internal", "request_id": getattr(request, "request_id", "-")}),
            500,
        )

    # ------------------------------------------------------------- ops routes
    @app.get("/health")
    def health():
        from .engine import engine_info

        info = engine_info()
        return jsonify(
            {
                "status": "ok",
                "version": settings.site.get("version", "2.0.0"),
                "model": {"loaded": not info["demo"], "engine": info["engine"], "classes": 26},
                "server": {"host": settings.host, "port": settings.port},
            }
        )

    @app.get("/ready")
    def ready():
        from .engine import get_engine

        get_engine()
        return jsonify({"ready": True})

    @app.get("/metrics")
    def metrics_route():
        return Response(metrics.prometheus_text(), mimetype="text/plain; version=0.0.4")

    # --------------------------------------------------------------- SPA root
    def _serve_spa(status: int = 200) -> Response:
        index = _spa_index()
        if not index.exists():
            return Response(
                "<h1>Front-end not built</h1><p>Run <code>npm ci && npm run build</code> inside "
                "<code>frontend/</code>, or see README for Docker instructions.</p>",
                status=503,
                mimetype="text/html",
            )
        resp = send_from_directory(FRONTEND_DIST, "index.html")
        resp.status_code = status
        resp.headers["Cache-Control"] = "no-cache"
        return resp

    @app.get("/")
    def root():
        return _serve_spa()

    @app.route("/<path:path>", methods=["GET"])
    def spa_catch_all(path: str):
        # Serve real files that live inside the built bundle first
        candidate = (FRONTEND_DIST / path).resolve()
        if candidate.is_file() and str(candidate).startswith(str(FRONTEND_DIST.resolve())):
            return send_from_directory(FRONTEND_DIST, path)
        if path.startswith(("api/", "static/")):
            return jsonify({"error": "Not found", "code": "not_found"}), 404
        # Known SPA routes → 200; anything else → 404 status with the app shell
        parts = [p for p in path.split("/") if p]
        known = (len(parts) == 1 and parts[0] in {"classify", "breeds", "docs", "model", "about"}) or (
            len(parts) == 2 and parts[0] == "breeds"
        )
        return _serve_spa(200 if known else 404)

    return app
