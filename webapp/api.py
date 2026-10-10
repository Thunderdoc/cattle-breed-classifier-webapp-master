"""REST API blueprint (v1 + legacy aliases)."""

from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Any, Dict, List

from flask import Blueprint, jsonify, request
from requests import RequestException

from . import breeds, metrics
from .config import FRONTEND_DIST, settings
from .engine import engine_info, get_engine
from .imaging import DecodedImage, ImageValidationError, decode_base64, decode_bytes
from .security import UnsafeUrlError, rate_limiter, safe_fetch_image

logger = logging.getLogger("cattle-classifier.api")

api = Blueprint("api", __name__)

SAMPLES_DIR = FRONTEND_DIST.parent / "dataset"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _error(message: str, code: str, status: int):
    resp = jsonify(
        {
            "error": message,
            "code": code,
            "request_id": getattr(request, "request_id", "-"),
        }
    )
    resp.status_code = status
    metrics.inc("prediction_errors_total") if code.startswith("predict") else None
    return resp


def _client_ip() -> str:
    fwd = request.headers.get("X-Forwarded-For", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.remote_addr or "unknown"


def _guard() -> Any:
    allowed, retry = rate_limiter.check(_client_ip())
    if not allowed:
        metrics.inc("rate_limited_total")
        resp = _error(
            f"Rate limit exceeded ({settings.rate_limit_requests} requests / {settings.rate_limit_window_s}s).",
            "rate_limited",
            429,
        )
        resp.headers["Retry-After"] = str(retry)
        return resp
    return None


def _resolve_url(url: str) -> bytes:
    """Fetch a remote image, or read allow-listed same-origin static assets from disk."""
    if url.startswith("/static/"):
        from .config import STATIC_DIR

        candidate = (STATIC_DIR / url[len("/static/") :]).resolve()
        root = STATIC_DIR.resolve()
        if str(candidate).startswith(str(root)) and candidate.is_file():
            return candidate.read_bytes()
        raise UnsafeUrlError("Static asset not found.")
    return safe_fetch_image(url)


def _load_request_image() -> DecodedImage:
    """Resolve the incoming image from multipart file, JSON url/base64, or ?url=."""
    if request.content_type and request.content_type.startswith("multipart/form-data"):
        if "file" not in request.files:
            raise ImageValidationError("No file provided. Send a 'file' field.")
        fh = request.files["file"]
        if not fh.filename:
            raise ImageValidationError("Empty filename.")
        return decode_bytes(fh.read())

    if request.is_json:
        body = request.get_json(silent=True) or {}
        if body.get("image"):
            return decode_base64(str(body["image"]))
        if body.get("url"):
            return decode_bytes(_resolve_url(str(body["url"])))
        raise ImageValidationError("JSON body must include 'image' (base64) or 'url'.")

    url = request.args.get("url")
    if url:
        return decode_bytes(_resolve_url(url))

    raise ImageValidationError("Provide an image: multipart 'file', JSON {'image'|'url'}, or ?url=.")


def _run_prediction(img: DecodedImage) -> Dict[str, Any]:
    engine = get_engine()
    top_n = request.args.get("top_n", type=int) or settings.top_n
    top_n = max(1, min(top_n, 10))
    result = engine.predict(img.image, top_n)

    keep = [p for p in result["predictions"] if p["prob"] >= settings.confidence_threshold]
    result["predictions"] = keep or result["predictions"][:1]

    info = engine_info()
    breed = breeds.by_class(result["class"])
    result.update(
        {
            "engine": info["engine"],
            "demo": info["demo"],
            "breed": {k: breed[k] for k in ("slug", "name", "species", "utility", "status")} if breed else None,
            "image": {
                "width": img.width,
                "height": img.height,
                "format": img.detected_format,
                "downscaled": img.downscaled,
            },
        }
    )
    return result


# ---------------------------------------------------------------------------
# v1 — system & reference data
# ---------------------------------------------------------------------------
@api.get("/api/v1/system")
def system():
    info = engine_info()
    return jsonify(
        {
            "name": "Indigenous Cattle Breed Classifier",
            "version": settings.site.get("version", "2.0.0"),
            "engine": info,
            "classes": len(breeds.class_names()),
            "limits": {
                "max_file_size_mb": settings.max_file_size_mb,
                "max_image_dimension": settings.max_image_dimension,
                "top_n_max": 10,
                "batch_max_images": settings.batch_max_images,
                "rate_limit": {
                    "requests": settings.rate_limit_requests,
                    "window_s": settings.rate_limit_window_s,
                },
            },
        }
    )


@api.get("/api/v1/classes")
def classes():
    return jsonify([c.replace("_", " ") for c in breeds.class_names()])


@api.get("/api/v1/breeds")
def breed_index():
    species = request.args.get("species")
    utility = request.args.get("utility")
    q = (request.args.get("q") or "").strip().lower()
    out = []
    for b in breeds.breed_list():
        if species and b["species"] != species:
            continue
        if utility and b["utility"] != utility:
            continue
        if q and q not in b["name"].lower() and q not in b["slug"] and q not in " ".join(b["traits"]).lower():
            continue
        out.append(b)
    return jsonify({"meta": breeds.breed_meta(), "count": len(out), "breeds": out})


@api.get("/api/v1/breeds/<slug>")
def breed_detail(slug: str):
    b = breeds.by_slug(slug)
    if not b:
        return _error(f"Unknown breed slug: {slug}", "not_found", 404)
    return jsonify(b)


@api.get("/api/v1/samples")
def samples():
    """Bundled real reference photos (manifest-backed, with credits)."""
    items: List[Dict[str, Any]] = []
    manifest_path = SAMPLES_DIR / "manifest.json"
    if manifest_path.exists():
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            items = [
                {
                    "name": m["name"],
                    "url": f"/static/dataset/{m['file']}",
                    "breed": m.get("breed"),
                    "credit": m.get("credit", ""),
                }
                for m in manifest
                if (SAMPLES_DIR / m["file"]).is_file()
            ]
        except (ValueError, KeyError):
            items = []
    if not items and SAMPLES_DIR.exists():  # fallback: directory scan
        for path in sorted(SAMPLES_DIR.glob("*")):
            if path.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp"):
                items.append(
                    {
                        "name": path.stem.replace("-", " ").title(),
                        "url": f"/static/dataset/{path.name}",
                        "breed": path.stem,
                        "credit": "",
                    }
                )
    return jsonify(items)


@api.get("/api/v1/stats")
def stats():
    all_breeds = breeds.breed_list()
    snap = metrics.snapshot()
    return jsonify(
        {
            "breeds": len(all_breeds),
            "cattle": sum(1 for b in all_breeds if b["species"] == "cattle"),
            "buffalo": sum(1 for b in all_breeds if b["species"] == "buffalo"),
            "states": len({b["origin"]["state"] for b in all_breeds}),
            "predictions_served": int(snap["predictions_total"]),
            "uptime_seconds": snap["uptime_seconds"],
            "engine": engine_info()["engine"],
            "demo": engine_info()["demo"],
        }
    )


# ---------------------------------------------------------------------------
# v1 — prediction
# ---------------------------------------------------------------------------
@api.route("/api/v1/predict", methods=["GET", "POST"])
def predict():
    blocked = _guard()
    if blocked:
        return blocked
    try:
        img = _load_request_image()
        result = _run_prediction(img)
        metrics.observe_inference(result["inference_time_ms"] / 1000.0)
        return jsonify(result)
    except (ImageValidationError, UnsafeUrlError) as exc:
        return _error(str(exc), "predict_bad_request", 400)
    except RequestException as exc:
        detail = exc.__class__.__name__
        return _error(
            f"Could not fetch the image from that URL ({detail}). Tip: paste a *direct* "
            f"image link (ending in .jpg/.png/.webp) — search-page URLs are not images. "
            f"On network-restricted deployments external hosts may be unreachable; "
            f"upload the file or use a bundled sample instead.",
            "predict_fetch_failed",
            400,
        )
    except Exception:
        logger.exception("Unexpected prediction error")
        return _error("Internal server error while running inference.", "predict_internal", 500)


@api.post("/api/v1/predict/batch")
def predict_batch():
    blocked = _guard()
    if blocked:
        return blocked
    metrics.inc("batch_requests_total")
    files = request.files.getlist("files")
    body = request.get_json(silent=True) if not files else None

    jobs: List[Dict[str, Any]] = []
    if files:
        jobs = [{"type": "file", "value": fh.read()} for fh in files[: settings.batch_max_images]]
    elif body and isinstance(body.get("images"), list):
        jobs = body["images"][: settings.batch_max_images]
    else:
        return _error(
            "Send multipart 'files[]' or JSON {'images': [{type: 'url'|'base64', value}]}",
            "batch_bad_request",
            400,
        )

    results = []
    engine = get_engine()
    for idx, item in enumerate(jobs):
        try:
            kind = item.get("type")
            if kind == "url":
                img = decode_bytes(_resolve_url(str(item["value"])))
            elif kind == "base64":
                img = decode_base64(str(item["value"]))
            elif kind == "file":
                img = decode_bytes(item["value"])
            else:
                results.append({"index": idx, "ok": False, "error": f"Unknown image type: {kind}"})
                continue
            res = engine.predict(img.image, settings.top_n)
            res["demo"] = engine.demo
            res["engine"] = engine.name
            results.append({"index": idx, "ok": True, "result": res})
            metrics.observe_inference(res["inference_time_ms"] / 1000.0)
        except Exception as exc:
            results.append({"index": idx, "ok": False, "error": str(exc)})
    return jsonify({"count": len(results), "results": results})


# ---------------------------------------------------------------------------
# Legacy endpoints (backwards compatible with v1.0 integrations)
# ---------------------------------------------------------------------------
@api.route("/api/classify", methods=["GET", "POST"])
def legacy_classify():
    blocked = _guard()
    if blocked:
        return blocked
    try:
        img = _load_request_image()
        result = _run_prediction(img)
        metrics.observe_inference(result["inference_time_ms"] / 1000.0)
        return jsonify(
            {
                "class": result["class"],
                "predictions": result["predictions"],
                "inference_time_ms": result["inference_time_ms"],
            }
        )
    except (ImageValidationError, UnsafeUrlError) as exc:
        return _error(str(exc), "predict_bad_request", 400)
    except Exception:
        logger.exception("Legacy classify failed")
        return _error("Internal server error", "predict_internal", 500)


@api.post("/api/classify/batch")
def legacy_batch():
    return predict_batch()


@api.get("/api/classes")
def legacy_classes():
    return classes()


@api.get("/config")
def legacy_config():
    return jsonify(settings.site)


@api.get("/ping")
def ping():
    return jsonify(
        {
            "status": "healthy",
            "model_loaded": not get_engine().demo,
            "num_classes": len(breeds.class_names()),
            "timestamp": time.time(),
            "request_id": uuid.uuid4().hex[:8],
        }
    )
