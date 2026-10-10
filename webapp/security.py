"""Security helpers: SSRF-safe URL fetching and per-IP rate limiting."""

from __future__ import annotations

import ipaddress
import socket
import threading
import time
from collections import deque
from typing import Deque, Dict, Tuple
from urllib.parse import urlsplit

import requests

from .config import settings

# ---------------------------------------------------------------------------
# SSRF-safe fetch
# ---------------------------------------------------------------------------
_PRIVATE_BLOCKS = [
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("100.64.0.0/10"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("192.0.2.0/24"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]


class UnsafeUrlError(ValueError):
    pass


def _is_public_ip(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    if addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_multicast or addr.is_reserved:
        return False
    return not any(addr in net for net in _PRIVATE_BLOCKS)


def safe_fetch_image(url: str) -> bytes:
    """Fetch ``url`` with scheme, DNS and size guards (SSRF protection)."""
    parsed = urlsplit(url)
    if parsed.scheme not in ("http", "https"):
        raise UnsafeUrlError("Only http(s) URLs are supported.")
    host = parsed.hostname
    if not host:
        raise UnsafeUrlError("Malformed URL.")
    try:
        infos = socket.getaddrinfo(host, parsed.port or 443, proto=socket.IPPROTO_TCP)
    except socket.gaierror as exc:
        raise UnsafeUrlError(f"Could not resolve host: {host}") from exc
    for info in infos:
        if not _is_public_ip(info[4][0]):
            raise UnsafeUrlError("URL resolves to a private or loopback address.")

    session = requests.Session()
    session.max_redirects = 3
    with session.get(
        url,
        timeout=settings.url_fetch_timeout_s,
        stream=True,
        headers={"User-Agent": "CattleBreedClassifier/2.0 (+image-fetch)"},
    ) as resp:
        resp.raise_for_status()
        ctype = resp.headers.get("Content-Type", "")
        if ctype and not ctype.split(";")[0].strip().startswith("image/"):
            raise UnsafeUrlError(f"URL did not return an image (Content-Type: {ctype or 'unknown'}).")
        chunks = []
        total = 0
        for chunk in resp.iter_content(chunk_size=64 * 1024):
            total += len(chunk)
            if total > settings.url_fetch_max_bytes:
                raise UnsafeUrlError("Remote image exceeds the size limit.")
            chunks.append(chunk)
    return b"".join(chunks)


# ---------------------------------------------------------------------------
# Rate limiting (sliding window, per client IP)
# ---------------------------------------------------------------------------
class RateLimiter:
    def __init__(self, limit: int, window_s: int) -> None:
        self.limit = limit
        window = window_s
        self._hits: Dict[str, Deque[float]] = {}
        self._lock = threading.Lock()
        self.window_s = window

    def check(self, key: str) -> Tuple[bool, int]:
        """Return (allowed, retry_after_seconds)."""
        if not settings.rate_limit_enabled:
            return True, 0
        now = time.time()
        with self._lock:
            dq = self._hits.setdefault(key, deque())
            while dq and now - dq[0] > self.window_s:
                dq.popleft()
            if len(dq) >= self.limit:
                return False, max(1, int(self.window_s - (now - dq[0])))
            dq.append(now)
            return True, 0

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


rate_limiter = RateLimiter(settings.rate_limit_requests, settings.rate_limit_window_s)
