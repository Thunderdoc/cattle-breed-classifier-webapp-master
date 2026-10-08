"""
Indigenous Cattle Breed Classifier — Production Web Application
==============================================================
A PyTorch + Flask web app that classifies cattle breeds from images.
Supports file upload and URL-based inference via a REST API and web UI.

Author: Ajit Kumar Singh
License: MIT
"""

from __future__ import annotations

import ast
import json
import logging
import os
import sys
import time
from io import BytesIO
from pathlib import Path
from typing import Any, ByteString, Dict, List, Union

import aiohttp
import asyncio
import gdown
import nest_asyncio
import requests
import torch
import uvicorn
import wget
import yaml
import warnings
from flask import Flask, jsonify, render_template, request
from PIL import Image
from torchvision import models, transforms
from torchvision.models.resnet import ResNet
from torch.nn.modules.conv import Conv2d

warnings.filterwarnings("ignore")
nest_asyncio.apply()

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("cattle-classifier")


# ---------------------------------------------------------------------------
# Safe globals for torch.load (PyTorch 2.x)
# ---------------------------------------------------------------------------
torch.serialization.add_safe_globals([ResNet, Conv2d])


# ---------------------------------------------------------------------------
# Configuration (loaded from config.yaml + env overrides)
# ---------------------------------------------------------------------------
HERE = Path(__file__).resolve().parent
MODELS_DIR = HERE / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# Google Drive URLs — override with env vars if hosting model elsewhere
EXPORT_FILE_URL = os.getenv(
    "EXPORT_FILE_URL",
    "https://drive.google.com/u/0/uc?id=1x5Ljh9xtNfXFMm97AMlewW1nZ77XS-gb&export=download",
)
EXPORT_CLASSES_URL = os.getenv(
    "EXPORT_CLASSES_URL",
    "https://drive.google.com/u/0/uc?id=1IaF_zn-RDnsEntYp86F5G7FNlEkQ8KJ_&export=download",
)
EXPORT_FILE_NAME = os.getenv("EXPORT_FILE_NAME", "cattle_breed_classifier_full_model.pth")
EXPORT_CLASSES_NAME = os.getenv("EXPORT_CLASSES_NAME", "classes.txt")

# Inference parameters
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "10"))  # 10 MB default
MAX_IMAGE_DIMENSION = int(os.getenv("MAX_IMAGE_DIMENSION", "2048"))
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.0"))  # filter low-confidence
TOP_N_PREDICTIONS = int(os.getenv("TOP_N_PREDICTIONS", "3"))
ALLOWED_MIME_PREFIXES = ("image/",)

# Server
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "5001"))
DEBUG = os.getenv("DEBUG", "false").lower() in ("true", "1", "yes")


# ---------------------------------------------------------------------------
# Model download helpers
# ---------------------------------------------------------------------------
async def download_file(url: str, dest: Path) -> None:
    """Download a file from ``url`` to ``dest`` if it does not already exist."""
    if dest.exists():
        logger.info("Model file already present: %s", dest.name)
        return
    logger.info("Downloading %s -> %s ...", url, dest.name)
    try:
        gdown.download(url, str(dest), quiet=False)
        logger.info("Download complete: %s", dest.name)
    except Exception as exc:
        logger.error("Failed to download %s: %s", dest.name, exc)
        raise


async def setup_learner() -> tuple[torch.nn.Module, List[str]]:
    """Download model + classes, load into memory, return (model, class_list)."""
    await download_file(EXPORT_FILE_URL, MODELS_DIR / EXPORT_FILE_NAME)
    await download_file(EXPORT_CLASSES_URL, MODELS_DIR / EXPORT_CLASSES_NAME)

    class_file = MODELS_DIR / EXPORT_CLASSES_NAME
    if not class_file.exists():
        raise FileNotFoundError(f"Classes file not found: {class_file}")

    with open(class_file, "r") as fh:
        class_list = [c.strip() for c in fh.read().split(",") if c.strip()]

    model_path = MODELS_DIR / EXPORT_FILE_NAME
    loaded = torch.load(model_path, map_location=torch.device("cpu"), weights_only=False)

    if isinstance(loaded, dict) and "state_dict" in loaded:
        model_arch = models.resnet18(weights=None)
        num_ftrs = model_arch.fc.in_features
        model_arch.fc = torch.nn.Linear(num_ftrs, len(class_list))
        model_arch.load_state_dict(loaded["state_dict"])
    else:
        model_arch = loaded

    model_arch.eval()
    logger.info(
        "Model loaded: %d classes, %s",
        len(class_list),
        model_arch.__class__.__name__,
    )
    return model_arch, class_list


# ---------------------------------------------------------------------------
# One-time model load at import time
# ---------------------------------------------------------------------------
logger.info("Loading model (this may take a moment on first run)...")
loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)
model, class_list = loop.run_until_complete(setup_learner())
loop.close()
logger.info("Model ready. Classes: %d", len(class_list))

# Load app metadata
CONFIG_PATH = HERE / "config.yaml"
if CONFIG_PATH.exists():
    with open(CONFIG_PATH, "r") as stream:
        APP_CONFIG = yaml.full_load(stream)
else:
    APP_CONFIG = {"title": "Cattle Breed Classifier", "description": "Classify cattle breeds from images."}


# ---------------------------------------------------------------------------
# Flask application
# ---------------------------------------------------------------------------
app = Flask(__name__, static_folder="static", template_folder="templates")
app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_SIZE_MB * 1024 * 1024  # Flask upload limit
app.jinja_env.auto_reload = DEBUG
app.config["TEMPLATES_AUTO_RELOAD"] = DEBUG


# ---------------------------------------------------------------------------
# Image helpers
# ---------------------------------------------------------------------------
def _validate_image(img: Image.Image) -> None:
    """Raise ValueError if the image is problematic."""
    if img.mode not in ("RGB", "L", "RGBA"):
        img = img.convert("RGB")
    w, h = img.size
    if w > MAX_IMAGE_DIMENSION or h > MAX_IMAGE_DIMENSION:
        raise ValueError(
            f"Image dimensions {w}x{h} exceed maximum {MAX_IMAGE_DIMENSION}px"
        )


def load_image_url(url: str) -> Image.Image:
    """Fetch an image from a URL and return a PIL Image."""
    logger.info("Fetching image from URL: %s", url)
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    img = Image.open(BytesIO(resp.content))
    _validate_image(img)
    return img


def load_image_bytes(raw_bytes: ByteString) -> Image.Image:
    """Decode image bytes into a PIL Image."""
    img = Image.open(BytesIO(raw_bytes))
    _validate_image(img)
    return img


# ---------------------------------------------------------------------------
# Inference
# ---------------------------------------------------------------------------
INFERENCE_TRANSFORM = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])


def predict(img: Image.Image, n: int = TOP_N_PREDICTIONS) -> Dict[str, Any]:
    """
    Run inference on *img* and return the top-*n* predictions.

    Returns
    -------
    dict
        ``{"class": top_breed, "predictions": [{class, output, prob}, ...]}``
    """
    t0 = time.perf_counter()
    tensor = INFERENCE_TRANSFORM(img).unsqueeze(0)
    with torch.no_grad():
        outputs = model(tensor).squeeze()
    pred_probs = torch.nn.functional.softmax(outputs, dim=-1)
    _, pred_class = torch.max(pred_probs, dim=0)

    predictions: List[Dict[str, Any]] = []
    for cls_name, logit, prob in zip(class_list, outputs.tolist(), pred_probs.tolist()):
        prob_rounded = round(prob, 4)
        if prob_rounded < CONFIDENCE_THRESHOLD:
            continue
        predictions.append({
            "class": cls_name.replace("_", " "),
            "output": round(logit, 2),
            "prob": prob_rounded,
        })

    # Sort by probability descending (more intuitive than raw logit)
    predictions.sort(key=lambda p: p["prob"], reverse=True)
    predictions = predictions[:n]

    elapsed_ms = (time.perf_counter() - t0) * 1000
    logger.info(
        "Prediction done in %.1fms — top class: %s (%.2f%%)",
        elapsed_ms,
        predictions[0]["class"] if predictions else "N/A",
        predictions[0]["prob"] * 100 if predictions else 0,
    )

    return {
        "class": class_list[pred_class.item()].replace("_", " "),
        "predictions": predictions,
        "inference_time_ms": round(elapsed_ms, 1),
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.route("/api/classify", methods=["POST", "GET"])
def classify():
    """Classify an image.

    POST — multipart file upload (``file`` field).
    GET  — ``?url=<image_url>`` query parameter.
    """
    try:
        if request.method == "POST":
            if "file" not in request.files:
                return jsonify({"error": "No file provided. Send a 'file' field."}), 400
            file = request.files["file"]
            if file.filename == "":
                return jsonify({"error": "Empty filename."}), 400
            if not file.content_type or not file.content_type.startswith(ALLOWED_MIME_PREFIXES):
                return jsonify({"error": f"Unsupported file type: {file.content_type}"}), 400
            img = load_image_bytes(file.read())
        else:  # GET
            url = request.args.get("url")
            if not url:
                return jsonify({"error": "Missing 'url' query parameter."}), 400
            img = load_image_url(url)

        result = predict(img)
        return jsonify(result)

    except ValueError as ve:
        logger.warning("Client error during classify: %s", ve)
        return jsonify({"error": str(ve)}), 400
    except requests.RequestException as re:
        logger.warning("URL fetch failed: %s", re)
        return jsonify({"error": f"Could not fetch image from URL: {re}"}), 400
    except Exception as exc:
        logger.exception("Unexpected error during classification")
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/classes", methods=["GET"])
def list_classes():
    """Return the full list of breed class names."""
    try:
        return jsonify([c.replace("_", " ") for c in class_list])
    except Exception:
        return jsonify({"error": "Unable to load classes"}), 500


@app.route("/ping", methods=["GET"])
def ping():
    """Health-check endpoint. Returns 'pong' with status metadata."""
    return jsonify({
        "status": "healthy",
        "model_loaded": True,
        "num_classes": len(class_list),
        "timestamp": time.time(),
    })


@app.route("/health", methods=["GET"])
def health():
    """Extended health check — useful for load balancers / Kubernetes."""
    return jsonify({
        "status": "ok",
        "version": APP_CONFIG.get("version", "1.0.0"),
        "model": {
            "loaded": True,
            "classes": len(class_list),
        },
        "server": {
            "host": HOST,
            "port": PORT,
        },
    })


@app.route("/config")
def get_config():
    """Return app metadata from config.yaml."""
    return jsonify(APP_CONFIG)


@app.route("/api/classify/batch", methods=["POST"])
def classify_batch():
    """
    Classify multiple images in one request.

    Expects JSON: ``{"images": [{"type": "url", "value": "..."}, {"type": "base64", "value": "..."}]}``
    Returns an array of results in the same order.
    """
    try:
        body = request.get_json(silent=True)
        if not body or "images" not in body:
            return jsonify({"error": "JSON body with 'images' array required"}), 400

        results: List[Dict[str, Any]] = []
        for idx, item in enumerate(body["images"]):
            try:
                if item.get("type") == "url":
                    img = load_image_url(item["value"])
                elif item.get("type") == "base64":
                    import base64
                    raw = base64.b64decode(item["value"])
                    img = load_image_bytes(raw)
                else:
                    results.append({"index": idx, "error": f"Unknown image type: {item.get('type')}"})
                    continue
                results.append({"index": idx, "result": predict(img)})
            except Exception as e:
                results.append({"index": idx, "error": str(e)})

        return jsonify({"results": results})
    except Exception:
        logger.exception("Batch classify failed")
        return jsonify({"error": "Batch processing failed"}), 500


@app.after_request
def _add_headers(response):
    """Security + cache-control headers on every response."""
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response


@app.route("/<path:path>")
def catch_all(path: str):
    """Serve static assets or fall back to the index page."""
    if any(path.endswith(ext) for ext in (".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg")):
        return app.send_static_file(path)
    return render_template("index.html")


@app.route("/")
def root():
    """Landing page."""
    return render_template("index.html")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    if "prepare" in sys.argv:
        logger.info("Prepare mode — skipping server start.")
        sys.exit(0)

    logger.info("Starting Cattle Breed Classifier on %s:%d", HOST, PORT)
    logger.info("Top-N predictions: %d | Confidence threshold: %.2f", TOP_N_PREDICTIONS, CONFIDENCE_THRESHOLD)
    app.run(debug=DEBUG, host=HOST, port=PORT)
