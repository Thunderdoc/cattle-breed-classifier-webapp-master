"""Inference engines.

Two engines ship with the app:

* :class:`TorchEngine` — the trained ResNet-18 checkpoint (used automatically when
  ``models/*.pth`` is present **and** PyTorch is installed).
* :class:`HeuristicEngine` — a transparent, deterministic coat-colour/texture prior
  used as a clearly-labelled fallback so every downstream integration path
  (upload, URL, batch, API console) remains exercisable when the trained
  checkpoint is unavailable. Responses always carry ``"demo": true`` in that mode.
"""

from __future__ import annotations

import logging
import threading
import time
from typing import Any, Dict, List, Optional

import numpy as np
from PIL import Image

from . import breeds
from .config import MODELS_DIR, settings

logger = logging.getLogger("cattle-classifier.engine")


class BaseEngine:
    name = "base"
    demo = False

    def predict(self, img: Image.Image, top_n: int) -> Dict[str, Any]:  # pragma: no cover
        raise NotImplementedError


class HeuristicEngine(BaseEngine):
    """Deterministic coat-colour / texture prior over the 26 breed descriptors."""

    name = "heuristic-color-prior"
    demo = True
    description = (
        "Deterministic coat-colour & texture prior (fallback). Not the trained model — "
        "deploy with the ResNet-18 checkpoint for research-grade accuracy."
    )

    # Descriptor colours are idealised; photographs live in a compressed,
    # desaturated colour space. This affine map projects descriptor RGB into
    # photographic RGB (fitted on bundled reference photos).
    PHOTO_A, PHOTO_B = 0.62, 43.6

    # Prototype statistics measured from the bundled real reference photographs
    # (coat RGB in photo space, dark-fraction, light-fraction). Breeds with a
    # reference photo use measured centroids; the rest use mapped descriptors.
    PROTOTYPES = {
        "Gir_Cow": ((173, 121, 84), 0.16, 0.23),
        "Sahiwal_Cow": ((117, 96, 84), 0.40, 0.10),
        "Red_Sindhi_Cow": ((142, 94, 71), 0.34, 0.04),
        "Dangi_Cow": ((169, 145, 116), 0.16, 0.43),
        "Khillar_Cow": ((163, 143, 118), 0.15, 0.43),
        "Tharparkar_Cow": ((159, 136, 106), 0.15, 0.23),
        "Murrah_Buffalo": ((97, 97, 92), 0.45, 0.06),
        "Mehsana_Buffalo": ((124, 120, 113), 0.25, 0.25),
        "Surti_Buffalo": ((142, 120, 99), 0.25, 0.29),
        "Jaffarabadi_Buffalo": ((104, 106, 107), 0.47, 0.24),
        "Nagpuri_Buffalo": ((82, 82, 84), 0.68, 0.10),
        "Banni_Buffalo": ((95, 79, 87), 0.53, 0.05),
        "Hariana_Cow": ((175, 165, 166), 0.07, 0.55),
        "Bhagnari_Cow": ((228, 222, 219), 0.03, 0.85),
    }

    def __init__(self) -> None:
        self.priors = breeds.color_priors()
        self.classes = list(self.priors.keys())
        rgb, dark, light = [], [], []
        for cls in self.classes:
            proto = self.PROTOTYPES.get(cls)
            if proto:
                (pr, pd, pl) = proto
                rgb.append(np.array(pr, dtype=np.float32) / 255.0)
                dark.append(pd)
                light.append(pl)
            else:
                desc = np.array(self.priors[cls], dtype=np.float32)
                mapped = (desc * self.PHOTO_A + self.PHOTO_B) / 255.0
                rgb.append(mapped)
                lum = float(0.299 * mapped[0] + 0.587 * mapped[1] + 0.114 * mapped[2])
                dark.append(float(np.clip((0.42 - lum) / 0.42, 0, 1)))
                light.append(float(np.clip((lum - 0.55) / 0.45, 0, 1)))
        self._rgb = np.array(rgb, dtype=np.float32)
        self._dark = np.array(dark, dtype=np.float32)
        self._light = np.array(light, dtype=np.float32)
        self.temperature = 0.14

    def _features(self, img: Image.Image) -> np.ndarray:
        """Coat-colour statistics with vegetation/sky masking.

        Outdoor photos are dominated by grass and sky; averaging the whole frame
        would measure the field, not the animal. We therefore (a) centre-crop,
        (b) drop green-dominant vegetation pixels and blown-out sky pixels, and
        (c) summarise the remaining "coat" pixels.
        """
        w, h = img.size
        box = (int(w * 0.18), int(h * 0.12), int(w * 0.82), int(h * 0.92))
        small = img.convert("RGB").crop(box).resize((64, 64), Image.BILINEAR)
        arr = np.asarray(small, dtype=np.float32) / 255.0
        r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
        lum = 0.299 * r + 0.587 * g + 0.114 * b

        vegetation = (g > r * 1.04) & (g > b * 1.04)
        sky = (b > r * 1.12) & (lum > 0.55)
        coat_mask = ~(vegetation | sky)
        if coat_mask.mean() < 0.12:  # fall back if masking removed everything
            coat_mask = np.ones_like(lum, dtype=bool)

        pixels = arr[coat_mask]
        rgb = pixels.mean(axis=0)
        coat_lum = lum[coat_mask]
        dark = float((coat_lum < 0.32).mean())
        light = float((coat_lum > 0.66).mean())
        sat = float((pixels.max(axis=1) - pixels.min(axis=1)).mean())
        edge = float(np.abs(np.diff(lum, axis=1)).mean() + np.abs(np.diff(lum, axis=0)).mean())
        return np.array([*rgb, dark, light, edge, sat], dtype=np.float32)

    def predict(self, img: Image.Image, top_n: int) -> Dict[str, Any]:
        t0 = time.perf_counter()
        f = self._features(img)
        rgb, dark, light, edge, sat = f[:3], f[3], f[4], f[5], f[6]

        d_rgb = np.linalg.norm(self._rgb - rgb[None, :], axis=1)
        d_dark = np.abs(self._dark - dark)
        d_light = np.abs(self._light - light)
        # texture/saturation act as mild regularisers
        dist = d_rgb * 1.0 + d_dark * 0.5 + d_light * 0.5 + abs(sat - 0.22) * 0.06 + edge * 0.04

        logits = -dist / self.temperature
        logits -= logits.max()
        probs = np.exp(logits)
        probs /= probs.sum()

        order = np.argsort(probs)[::-1][: max(1, top_n)]
        predictions = [
            {
                "class": self.classes[i].replace("_", " "),
                "output": round(float(-dist[i]), 4),
                "prob": round(float(probs[i]), 4),
            }
            for i in order
        ]
        top_idx = int(order[0])
        elapsed = (time.perf_counter() - t0) * 1000
        return {
            "class": self.classes[top_idx].replace("_", " "),
            "predictions": predictions,
            "inference_time_ms": round(elapsed, 1),
        }


class TorchEngine(BaseEngine):
    """Real inference with the trained ResNet-18 checkpoint."""

    name = "resnet18-finetuned"
    demo = False
    description = "ResNet-18 fine-tuned on ~4,000 indigenous cattle images (26 classes)."

    def __init__(self, model: Any, class_list: List[str]) -> None:
        self.model = model
        self.classes = class_list

    def predict(self, img: Image.Image, top_n: int) -> Dict[str, Any]:
        import torch  # local import: optional dependency

        from .imaging import to_array

        t0 = time.perf_counter()
        tensor = torch.from_numpy(to_array(img, settings.resize_dim))
        with torch.no_grad():
            outputs = self.model(tensor).squeeze(-1)
        probs = torch.nn.functional.softmax(outputs, dim=-1).squeeze()
        order = torch.argsort(probs, descending=True)[: max(1, top_n)]
        predictions = [
            {
                "class": self.classes[i].replace("_", " "),
                "output": round(float(outputs[i]), 4),
                "prob": round(float(probs[i]), 4),
            }
            for i in order.tolist()
        ]
        top = int(torch.argmax(probs))
        elapsed = (time.perf_counter() - t0) * 1000
        return {
            "class": self.classes[top].replace("_", " "),
            "predictions": predictions,
            "inference_time_ms": round(elapsed, 1),
        }


# ---------------------------------------------------------------------------
# Engine resolution
# ---------------------------------------------------------------------------
_lock = threading.Lock()
_engine: Optional[BaseEngine] = None
_engine_error: Optional[str] = None


def _load_classes() -> Optional[List[str]]:
    path = MODELS_DIR / settings.classes_name
    if not path.exists():
        return None
    try:
        with open(path, "r", encoding="utf-8") as fh:
            names = [c.strip() for c in fh.read().split(",") if c.strip()]
        return names or None
    except OSError:
        return None


def _load_torch(class_list: List[str]) -> Optional[TorchEngine]:
    try:
        import torch
        from torchvision import models
    except Exception as exc:  # torch not installed
        logger.info("PyTorch unavailable (%s) — falling back to heuristic engine.", exc)
        return None

    weights = MODELS_DIR / settings.model_file_name
    if not weights.exists():
        logger.info("No model checkpoint at %s — falling back to heuristic engine.", weights)
        return None

    try:
        loaded = torch.load(weights, map_location=torch.device("cpu"), weights_only=False)
        if isinstance(loaded, dict) and "state_dict" in loaded:
            arch = models.resnet18(weights=None)
            arch.fc = torch.nn.Linear(arch.fc.in_features, len(class_list))
            arch.load_state_dict(loaded["state_dict"])
        else:
            arch = loaded
        arch.eval()
        logger.info("Loaded trained checkpoint: %s (%d classes)", weights.name, len(class_list))
        return TorchEngine(arch, class_list)
    except Exception as exc:
        logger.error("Failed to load checkpoint %s: %s", weights, exc)
        return None


def get_engine() -> BaseEngine:
    global _engine, _engine_error
    with _lock:
        if _engine is not None:
            return _engine
        class_list = _load_classes() or breeds.class_names()
        engine = _load_torch(class_list)
        if engine is None:
            _engine_error = (
                "Trained checkpoint not present — serving heuristic demo engine. "
                "Place the ResNet-18 .pth in models/ (or run scripts/download_model.py) "
                "and install torch for production inference."
            )
            engine = HeuristicEngine()
        _engine = engine
        return engine


def engine_info() -> Dict[str, Any]:
    engine = get_engine()
    return {
        "engine": engine.name,
        "demo": engine.demo,
        "description": getattr(engine, "description", ""),
        "notice": _engine_error if engine.demo else None,
    }
