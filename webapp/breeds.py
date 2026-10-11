"""Breed encyclopedia data access."""

from __future__ import annotations

import json
from functools import lru_cache
from typing import Any, Dict, List, Optional

from .config import BREEDS_PATH


@lru_cache(maxsize=1)
def _raw() -> Dict[str, Any]:
    with open(BREEDS_PATH, "r", encoding="utf-8") as fh:
        return json.load(fh)


def breed_list() -> List[Dict[str, Any]]:
    return _raw().get("breeds", [])


def breed_meta() -> Dict[str, Any]:
    return _raw().get("meta", {})


def by_slug(slug: str) -> Optional[Dict[str, Any]]:
    for b in breed_list():
        if b["slug"] == slug:
            return b
    return None


def by_class(class_name: str) -> Optional[Dict[str, Any]]:
    norm = class_name.replace(" ", "_").lower()
    for b in breed_list():
        if b["class"].lower() == norm:
            return b
    return None


def class_names() -> List[str]:
    return [b["class"] for b in breed_list()]


def color_priors() -> Dict[str, List[float]]:
    """Map class name -> [r, g, b] coat-colour prior (used by the heuristic engine)."""
    return {b["class"]: [float(c) for c in b.get("color_rgb", [128, 128, 128])] for b in breed_list()}
