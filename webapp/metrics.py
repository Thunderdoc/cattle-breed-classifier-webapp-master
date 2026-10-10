"""Lightweight in-process metrics with a Prometheus text exposition."""

from __future__ import annotations

import threading
import time
from typing import Dict

_lock = threading.Lock()
_counters: Dict[str, float] = {
    "requests_total": 0,
    "predictions_total": 0,
    "prediction_errors_total": 0,
    "batch_requests_total": 0,
    "rate_limited_total": 0,
    "inference_seconds_sum": 0.0,
}
_started_at = time.time()


def inc(name: str, amount: float = 1.0) -> None:
    with _lock:
        _counters[name] = _counters.get(name, 0.0) + amount


def observe_inference(seconds: float) -> None:
    with _lock:
        _counters["inference_seconds_sum"] += seconds
        _counters["predictions_total"] += 1


def snapshot() -> Dict[str, float]:
    with _lock:
        data = dict(_counters)
    data["uptime_seconds"] = round(time.time() - _started_at, 1)
    return data


def prometheus_text() -> str:
    data = snapshot()
    lines = [
        "# HELP cattle_requests_total Total HTTP requests handled.",
        "# TYPE cattle_requests_total counter",
        f'cattle_requests_total {data["requests_total"]:.0f}',
        "# HELP cattle_predictions_total Total predictions served.",
        "# TYPE cattle_predictions_total counter",
        f'cattle_predictions_total {data["predictions_total"]:.0f}',
        "# HELP cattle_prediction_errors_total Failed predictions.",
        "# TYPE cattle_prediction_errors_total counter",
        f'cattle_prediction_errors_total {data["prediction_errors_total"]:.0f}',
        "# HELP cattle_batch_requests_total Batch requests served.",
        "# TYPE cattle_batch_requests_total counter",
        f'cattle_batch_requests_total {data["batch_requests_total"]:.0f}',
        "# HELP cattle_rate_limited_total Requests rejected by the rate limiter.",
        "# TYPE cattle_rate_limited_total counter",
        f'cattle_rate_limited_total {data["rate_limited_total"]:.0f}',
        "# HELP cattle_inference_seconds_sum Cumulative inference time.",
        "# TYPE cattle_inference_seconds_sum counter",
        f'cattle_inference_seconds_sum {data["inference_seconds_sum"]:.4f}',
        "# HELP cattle_uptime_seconds Process uptime.",
        "# TYPE cattle_uptime_seconds gauge",
        f'cattle_uptime_seconds {data["uptime_seconds"]}',
    ]
    return "\n".join(lines) + "\n"
