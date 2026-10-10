"""Engine + imaging unit tests."""

from __future__ import annotations

from pathlib import Path

import pytest
from PIL import Image

from webapp.engine import HeuristicEngine
from webapp.imaging import ImageValidationError, decode_bytes, to_array

SAMPLE = Path(__file__).resolve().parent.parent / "static" / "samples" / "gir-cow.jpg"


@pytest.fixture(scope="module")
def engine():
    return HeuristicEngine()


def test_heuristic_is_deterministic(engine):
    img = Image.open(SAMPLE)
    a = engine.predict(img, 3)
    b = engine.predict(img, 3)
    assert a["predictions"] == b["predictions"]


def test_heuristic_labels_reference_photos(engine):
    samples = {
        "gir-cow.jpg": "Gir Cow",
        "murrah-buffalo.jpg": "Murrah Buffalo",
        "sahiwal-cow.jpg": "Sahiwal Cow",
        "dangi-cow.jpg": "Dangi Cow",
    }
    root = SAMPLE.parent
    for fname, expected in samples.items():
        img = Image.open(root / fname)
        assert engine.predict(img, 1)["class"] == expected, fname


def test_to_array_shape():
    img = Image.open(SAMPLE)
    arr = to_array(img, 224)
    assert arr.shape == (1, 3, 224, 224)


def test_decode_rejects_non_image():
    with pytest.raises(ImageValidationError):
        decode_bytes(b"definitely not an image")


def test_decode_accepts_png():
    buf = __import__("io").BytesIO()
    Image.new("RGB", (64, 64), (10, 120, 200)).save(buf, format="PNG")
    dec = decode_bytes(buf.getvalue())
    assert dec.detected_format == "png"
    assert dec.width == 64
