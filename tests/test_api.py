"""API contract tests — run with: pytest -q"""

from __future__ import annotations

import io
import json
from pathlib import Path

import pytest

from webapp.factory import create_app

SAMPLE = Path(__file__).resolve().parent.parent / "static" / "samples" / "gir-cow.jpg"


@pytest.fixture()
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.get_json()
    assert body["status"] == "ok"
    assert body["model"]["classes"] == 26


def test_ready_and_ping(client):
    assert client.get("/ready").status_code == 200
    assert client.get("/ping").status_code == 200


def test_metrics_prometheus(client):
    r = client.get("/metrics")
    assert r.status_code == 200
    assert "cattle_requests_total" in r.get_data(as_text=True)


def test_system_metadata(client):
    body = client.get("/api/v1/system").get_json()
    assert body["classes"] == 26
    assert body["engine"]["engine"] in ("resnet18-finetuned", "heuristic-color-prior")
    assert body["limits"]["max_file_size_mb"] >= 1


def test_classes_endpoint(client):
    classes = client.get("/api/v1/classes").get_json()
    assert len(classes) == 26
    assert "Gir Cow" in classes


def test_breeds_filters(client):
    all_breeds = client.get("/api/v1/breeds").get_json()
    assert all_breeds["count"] == 26
    buffalo = client.get("/api/v1/breeds?species=buffalo").get_json()
    assert buffalo["count"] == 6
    assert all(b["species"] == "buffalo" for b in buffalo["breeds"])
    searched = client.get("/api/v1/breeds?q=desert").get_json()
    assert searched["count"] >= 1


def test_breed_detail_and_404(client):
    gir = client.get("/api/v1/breeds/gir-cow").get_json()
    assert gir["name"] == "Gir"
    assert client.get("/api/v1/breeds/nope").status_code == 404


def test_predict_multipart(client):
    data = {"file": (io.BytesIO(SAMPLE.read_bytes()), "cow.jpg")}
    r = client.post("/api/v1/predict", data=data, content_type="multipart/form-data")
    assert r.status_code == 200
    body = r.get_json()
    assert body["class"]
    assert body["predictions"]
    assert 0 < body["predictions"][0]["prob"] <= 1
    assert body["image"]["format"] == "jpeg"
    assert "engine" in body and "demo" in body


def test_predict_top_n(client):
    data = {"file": (io.BytesIO(SAMPLE.read_bytes()), "cow.jpg")}
    body = client.post("/api/v1/predict?top_n=2", data=data, content_type="multipart/form-data").get_json()
    assert len(body["predictions"]) == 2


def test_predict_rejects_garbage(client):
    data = {"file": (io.BytesIO(b"not an image at all"), "x.jpg")}
    r = client.post("/api/v1/predict", data=data, content_type="multipart/form-data")
    assert r.status_code == 400
    assert r.get_json()["code"] == "predict_bad_request"


def test_predict_missing_input(client):
    assert client.post("/api/v1/predict", json={}).status_code == 400


def test_ssrf_guard_blocks_loopback(client):
    r = client.get("/api/v1/predict?url=http://127.0.0.1:9/x.jpg")
    assert r.status_code == 400


def test_batch_multipart(client):
    data = {
        "files": [
            (io.BytesIO(SAMPLE.read_bytes()), "a.jpg"),
            (io.BytesIO(SAMPLE.read_bytes()), "b.jpg"),
        ]
    }
    r = client.post("/api/v1/predict/batch", data=data, content_type="multipart/form-data")
    assert r.status_code == 200
    body = r.get_json()
    assert body["count"] == 2
    assert all(item["ok"] for item in body["results"])


def test_legacy_aliases(client):
    classes = client.get("/api/classes").get_json()
    assert len(classes) == 26
    data = {"file": (io.BytesIO(SAMPLE.read_bytes()), "cow.jpg")}
    legacy = client.post("/api/classify", data=data, content_type="multipart/form-data").get_json()
    assert "class" in legacy and "predictions" in legacy
    assert client.get("/config").status_code == 200


def test_spa_routes(client):
    for path in ("/", "/classify", "/breeds", "/breeds/gir-cow", "/docs", "/model", "/about", "/whatever"):
        r = client.get(path)
        assert r.status_code == 200, path
        assert "text/html" in r.content_type


def test_security_headers(client):
    r = client.get("/api/v1/classes")
    assert r.headers["X-Content-Type-Options"] == "nosniff"
    assert "Content-Security-Policy" in r.headers
    assert r.headers["Access-Control-Allow-Origin"] == "*"


def test_error_envelope_has_request_id(client):
    r = client.get("/api/v1/breeds/nope")
    body = r.get_json()
    assert set(body) >= {"error", "code", "request_id"}


def test_samples_listing(client):
    samples = client.get("/api/v1/samples").get_json()
    assert isinstance(samples, list) and samples
    assert samples[0]["url"].startswith("/static/samples/")


def test_stats(client):
    body = client.get("/api/v1/stats").get_json()
    assert body["breeds"] == 26
    assert body["cattle"] + body["buffalo"] == 26
