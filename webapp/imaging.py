"""Image decoding, validation and pre-processing (framework-agnostic)."""

from __future__ import annotations

import base64
import binascii
from dataclasses import dataclass
from io import BytesIO
from typing import ByteString, Tuple

import numpy as np
from PIL import Image, ImageOps

from .config import settings

# Magic-byte signatures we accept (content sniffing, not MIME trust)
_SIGNATURES = (
    (b"\xff\xd8\xff", "jpeg"),
    (b"\x89PNG\r\n\x1a\n", "png"),
    (b"RIFF", "webp"),  # + WEBP at offset 8
    (b"GIF8", "gif"),
    (b"BM", "bmp"),
    (b"\x00\x00\x01\x00", "ico"),
)

MAX_DECODE_PIXELS = 60_000_000  # decompression-bomb guard


@dataclass
class DecodedImage:
    image: Image.Image
    width: int
    height: int
    detected_format: str
    downscaled: bool = False


class ImageValidationError(ValueError):
    """Raised when an uploaded payload is not an acceptable image."""


def sniff_format(raw: bytes) -> str:
    for sig, name in _SIGNATURES:
        if raw.startswith(sig):
            if name == "webp" and raw[8:12] != b"WEBP":
                continue
            return name
    return "unknown"


def decode_bytes(raw: bytes) -> DecodedImage:
    fmt = sniff_format(raw)
    if fmt == "unknown":
        raise ImageValidationError(
            "Unsupported file type. Upload a JPEG, PNG, WebP, GIF or BMP image."
        )
    if len(raw) > settings.max_file_size_mb * 1024 * 1024:
        raise ImageValidationError(
            f"File exceeds the {settings.max_file_size_mb} MB upload limit."
        )
    try:
        img = Image.open(BytesIO(raw))
        img.load()
    except Exception as exc:  # truncated / corrupt files
        raise ImageValidationError(f"Could not decode image: {exc.__class__.__name__}") from exc

    # Decompression-bomb guard
    w, h = img.size
    if w * h > MAX_DECODE_PIXELS:
        raise ImageValidationError("Image resolution is too large to process safely.")

    # Honour EXIF orientation so phone photos classify upright
    try:
        img = ImageOps.exif_transpose(img)
    except Exception:
        pass

    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    downscaled = False
    limit = settings.max_image_dimension
    if max(img.size) > limit:
        ratio = limit / max(img.size)
        img = img.resize(
            (max(1, int(img.width * ratio)), max(1, int(img.height * ratio))),
            Image.LANCZOS,
        )
        downscaled = True

    return DecodedImage(
        image=img,
        width=img.width,
        height=img.height,
        detected_format=fmt,
        downscaled=downscaled,
    )


def decode_base64(payload: str) -> DecodedImage:
    # Tolerate data-URL prefixes
    if "," in payload and payload.split(",", 1)[0].startswith("data:"):
        payload = payload.split(",", 1)[1]
    try:
        raw = base64.b64decode(payload, validate=False)
    except (binascii.Error, ValueError) as exc:
        raise ImageValidationError(f"Invalid base64 payload: {exc}") from exc
    return decode_bytes(raw)


def to_array(img: Image.Image, size: int = 224) -> np.ndarray:
    """Resize + ImageNet normalisation → float32 array of shape (1, 3, H, W)."""
    rgb = img.convert("RGB").resize((size, size), Image.BILINEAR)
    arr = np.asarray(rgb, dtype=np.float32) / 255.0
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    arr = (arr - mean) / std
    return np.transpose(arr, (2, 0, 1))[None, ...]


def thumbnail_data_url(img: Image.Image, size: Tuple[int, int] = (96, 96)) -> str:
    """Tiny JPEG data URL used for history thumbnails in the UI."""
    thumb = img.convert("RGB").copy()
    thumb.thumbnail(size, Image.LANCZOS)
    buf = BytesIO()
    thumb.save(buf, format="JPEG", quality=70)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def as_bytes(raw: ByteString) -> bytes:
    return bytes(raw)
