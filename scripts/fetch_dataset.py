#!/usr/bin/env python3
"""Fetch and ingest the full cattle-breed image corpus.

The repository ships a small, hand-verified reference subset under
``static/dataset/``.  This script is the production path to the complete
training corpus (≈4,000 labelled photographs, extensible to 10,000+):

  1. ``--url``   download a zip archive (Google-Drive share links supported,
                 or any direct zip URL; Kaggle exports work once re-zipped),
                 or ``--from-dir`` to ingest an existing local folder tree.
  2. ``--ingest`` walk ``<breed class>/`` folders, de-duplicate by SHA-256,
                 normalise every photograph (JPEG, ≤1024 px) and file it under
                 ``static/dataset/<breed-slug>/NN.jpg``, appending provenance
                 entries to ``static/dataset/gallery.json``.

Examples
--------
    python3 scripts/fetch_dataset.py --url "$DATASET_ZIP_URL" --out data/raw
    python3 scripts/fetch_dataset.py --from-dir /mnt/cattle-images --ingest
    python3 scripts/fetch_dataset.py --ingest            # reuse data/raw
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATASET_DIR = ROOT / "static" / "dataset"
GALLERY = DATASET_DIR / "gallery.json"
BREEDS = ROOT / "data" / "breeds.json"
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def class_to_slug() -> dict[str, str]:
    data = json.loads(BREEDS.read_text(encoding="utf-8"))
    breeds = data["breeds"] if isinstance(data, dict) else data
    return {b["class"].lower().replace("_", " "): b["slug"] for b in breeds}


def download(url: str, dest: Path) -> Path:
    import requests

    dest.parent.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    print(f"→ downloading {url}")
    resp = session.get(url, stream=True, timeout=60)
    if "drive.google.com" in url and resp.status_code == 200 and "confirm" in resp.text[:2000]:
        token = re.search(r'name="confirm" value="([0-9A-Za-z_-]+)"', resp.text)
        uuid = re.search(r'"uuid":"([0-9A-Za-z_-]+)"', resp.text)
        params = {"confirm": token.group(1) if token else "t"}
        if uuid:
            params["uuid"] = uuid.group(1)
        resp = session.get(url, params=params, stream=True, timeout=60)
    resp.raise_for_status()
    with dest.open("wb") as fh:
        for chunk in resp.iter_content(chunk_size=1 << 20):
            fh.write(chunk)
    print(f"→ saved {dest} ({dest.stat().st_size // 1024} KB)")
    return dest


def extract(zip_path: Path, out: Path) -> Path:
    out.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(out)
    print(f"→ extracted to {out}")
    return out


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def ingest(src_root: Path, max_per_breed: int, credit: str) -> None:
    from PIL import Image

    slugs = class_to_slug()
    gallery = json.loads(GALLERY.read_text(encoding="utf-8")) if GALLERY.exists() else {"breeds": []}
    by_breed = {e["breed"]: e for e in gallery["breeds"]}
    seen = {sha256(p) for p in DATASET_DIR.rglob("*") if p.is_file() and p.suffix.lower() in IMAGE_EXT}
    added: dict[str, int] = {}

    for folder in sorted(p for p in src_root.iterdir() if p.is_dir()):
        slug = slugs.get(folder.name.lower().replace("_", " ").strip())
        if not slug:
            print(f"  · skip unknown class folder: {folder.name}")
            continue
        target = DATASET_DIR / slug
        target.mkdir(parents=True, exist_ok=True)
        next_idx = max([int(p.stem) for p in target.glob("*.jpg") if p.stem.isdigit()], default=0) + 1
        entry = by_breed.setdefault(slug, {"breed": slug, "name": folder.name.replace("_", " ").title(), "images": []})
        for img in sorted(p for p in folder.iterdir() if p.suffix.lower() in IMAGE_EXT):
            digest = sha256(img)
            if digest in seen:
                continue
            seen.add(digest)
            try:
                with Image.open(img) as im:
                    im = im.convert("RGB")
                    im.thumbnail((1024, 1024), Image.LANCZOS)
                    out_path = target / f"{next_idx:02d}.jpg"
                    im.save(out_path, "JPEG", quality=82, optimize=True, progressive=True)
            except Exception as exc:  # noqa: BLE001 - one bad file must not stop ingestion
                print(f"  ! unreadable {img.name}: {exc}")
                continue
            entry["images"].append({"file": f"{slug}/{out_path.name}", "credit": credit})
            added[slug] = added.get(slug, 0) + 1
            next_idx += 1
            if max_per_breed and added[slug] >= max_per_breed:
                break

    gallery["breeds"] = list(by_breed.values())
    GALLERY.write_text(json.dumps(gallery, indent=2, ensure_ascii=False), encoding="utf-8")
    total = sum(added.values())
    print(f"✓ ingested {total} photographs across {len(added)} breeds")
    for slug, n in sorted(added.items()):
        print(f"    {slug:<22} +{n}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", help="zip archive URL (Google Drive share links supported)")
    ap.add_argument("--out", default="data/raw", help="download/extract root (default: data/raw)")
    ap.add_argument("--from-dir", help="ingest an existing local folder tree instead of downloading")
    ap.add_argument("--ingest", action="store_true", help="file downloaded/located images into static/dataset/")
    ap.add_argument("--max-per-breed", type=int, default=0, help="cap per breed (0 = no cap)")
    ap.add_argument("--credit", default="Ingested from training corpus via scripts/fetch_dataset.py")
    args = ap.parse_args()

    out = ROOT / args.out
    src = Path(args.from_dir) if args.from_dir else out

    if args.url:
        zip_path = out / "corpus.zip"
        download(args.url, zip_path)
        extract(zip_path, out / "extracted")
        src = out / "extracted"
    elif not src.exists() and args.ingest:
        print("nothing to ingest: pass --url or --from-dir, or run a download first", file=sys.stderr)
        return 1

    if args.ingest:
        ingest(src, args.max_per_breed, args.credit)
    else:
        print(f"→ staged under {src}; re-run with --ingest to file the photographs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
