"""Runtime configuration: config.yaml merged with environment overrides."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List

import yaml

HERE = Path(__file__).resolve().parent.parent
CONFIG_PATH = HERE / "config.yaml"
BREEDS_PATH = HERE / "data" / "breeds.json"
MODELS_DIR = HERE / "models"
STATIC_DIR = HERE / "static"
FRONTEND_DIST = STATIC_DIR / "app"


def _env(name: str, default: str) -> str:
    return os.getenv(name, default)


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except ValueError:
        return default


def _env_bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in ("1", "true", "yes", "on")


@dataclass
class Settings:
    """All runtime knobs in one place."""

    # Server
    host: str = field(default_factory=lambda: _env("HOST", "0.0.0.0"))
    port: int = field(default_factory=lambda: _env_int("PORT", 5001))
    debug: bool = field(default_factory=lambda: _env_bool("DEBUG", False))

    # Inference
    max_file_size_mb: int = field(default_factory=lambda: _env_int("MAX_FILE_SIZE_MB", 10))
    max_image_dimension: int = field(default_factory=lambda: _env_int("MAX_IMAGE_DIMENSION", 4096))
    resize_dim: int = field(default_factory=lambda: _env_int("RESIZE_DIM", 224))
    confidence_threshold: float = field(default_factory=lambda: _env_float("CONFIDENCE_THRESHOLD", 0.0))
    top_n: int = field(default_factory=lambda: _env_int("TOP_N_PREDICTIONS", 5))
    batch_max_images: int = field(default_factory=lambda: _env_int("BATCH_MAX_IMAGES", 16))

    # Model artifacts
    model_file_name: str = field(default_factory=lambda: _env("EXPORT_FILE_NAME", "cattle_breed_classifier_full_model.pth"))
    model_file_url: str = field(
        default_factory=lambda: _env(
            "EXPORT_FILE_URL",
            "https://drive.google.com/u/0/uc?id=1x5Ljh9xtNfXFMm97AMlewW1nZ77XS-gb&export=download",
        )
    )
    classes_name: str = field(default_factory=lambda: _env("EXPORT_CLASSES_NAME", "classes.txt"))
    classes_url: str = field(
        default_factory=lambda: _env(
            "EXPORT_CLASSES_URL",
            "https://drive.google.com/u/0/uc?id=1IaF_zn-RDnsEntYp86F5G7FNlEkQ8KJ_&export=download",
        )
    )

    # Security / rate limiting
    rate_limit_enabled: bool = field(default_factory=lambda: _env_bool("RATE_LIMIT_ENABLED", True))
    rate_limit_requests: int = field(default_factory=lambda: _env_int("RATE_LIMIT_REQUESTS", 60))
    rate_limit_window_s: int = field(default_factory=lambda: _env_int("RATE_LIMIT_WINDOW_S", 60))
    allowed_origins: List[str] = field(
        default_factory=lambda: [o.strip() for o in _env("ALLOWED_ORIGINS", "*").split(",") if o.strip()]
    )
    url_fetch_timeout_s: float = field(default_factory=lambda: _env_float("URL_FETCH_TIMEOUT_S", 10.0))
    url_fetch_max_bytes: int = field(default_factory=lambda: _env_int("URL_FETCH_MAX_BYTES", 15 * 1024 * 1024))

    # Site metadata (config.yaml)
    site: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def load(cls) -> "Settings":
        s = cls()
        if CONFIG_PATH.exists():
            with open(CONFIG_PATH, "r", encoding="utf-8") as fh:
                raw = yaml.safe_load(fh) or {}
            s.site = raw
            inference = raw.get("inference", {}) or {}
            # config.yaml values act as defaults; env always wins
            if "TOP_N_PREDICTIONS" not in os.environ and inference.get("top_n"):
                s.top_n = int(inference["top_n"])
            if "CONFIDENCE_THRESHOLD" not in os.environ and inference.get("confidence_threshold") is not None:
                s.confidence_threshold = float(inference["confidence_threshold"])
            if "MAX_FILE_SIZE_MB" not in os.environ and inference.get("max_file_size_mb"):
                s.max_file_size_mb = int(inference["max_file_size_mb"])
            if "MAX_IMAGE_DIMENSION" not in os.environ and inference.get("max_image_dimension"):
                s.max_image_dimension = int(inference["max_image_dimension"])
            model = raw.get("model", {}) or {}
            if "EXPORT_FILE_URL" not in os.environ and model.get("file_url"):
                s.model_file_url = model["file_url"]
            if "EXPORT_CLASSES_URL" not in os.environ and model.get("classes_url"):
                s.classes_url = model["classes_url"]
            if "EXPORT_FILE_NAME" not in os.environ and model.get("file_name"):
                s.model_file_name = model["file_name"]
            if "EXPORT_CLASSES_NAME" not in os.environ and model.get("classes_name"):
                s.classes_name = model["classes_name"]
        return s


settings = Settings.load()
