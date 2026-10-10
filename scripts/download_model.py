#!/usr/bin/env python3
"""Fetch the trained checkpoint + class list into models/.

Defaults to the original Google Drive locations; override with the
EXPORT_FILE_URL / EXPORT_CLASSES_URL environment variables to point at your
own object storage (any http(s) URL works).
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
MODELS = HERE / "models"
MODELS.mkdir(exist_ok=True)

FILE_URL = os.getenv("EXPORT_FILE_URL", "https://drive.google.com/u/0/uc?id=1x5Ljh9xtNfXFMm97AMlewW1nZ77XS-gb&export=download")
CLASSES_URL = os.getenv("EXPORT_CLASSES_URL", "https://drive.google.com/u/0/uc?id=1IaF_zn-RDnsEntYp86F5G7FNlEkQ8KJ_&export=download")
FILE_NAME = os.getenv("EXPORT_FILE_NAME", "cattle_breed_classifier_full_model.pth")
CLASSES_NAME = os.getenv("EXPORT_CLASSES_NAME", "classes.txt")


def fetch(url: str, dest: Path) -> None:
    if dest.exists():
        print(f"= already present: {dest}")
        return
    print(f"↓ {url}\n  → {dest}")
    if "drive.google.com" in url:
        try:
            import gdown

            gdown.download(url, str(dest), quiet=False, fuzzy=True)
            return
        except ImportError:
            print("  (gdown not installed — pip install gdown, or use a direct URL)")
            sys.exit(1)
    import urllib.request

    urllib.request.urlretrieve(url, dest)


if __name__ == "__main__":
    fetch(FILE_URL, MODELS / FILE_NAME)
    fetch(CLASSES_URL, MODELS / CLASSES_NAME)
    print("done. restart the server to load the checkpoint.")
