# 🐄 Bovine AI — Indigenous Cattle Breed Classifier

**Identify 26 indigenous Indian cattle & buffalo breeds from a single photo.**
Fine-tuned ResNet-18 inference in milliseconds, a researched breed encyclopedia,
and a production-grade REST API — wrapped in a premium React front-end.

[![Python](https://img.shields.io/badge/python-3.9%2B-blue.svg)](https://www.python.org/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.x-orange.svg)](https://pytorch.org/)
[![Flask](https://img.shields.io/badge/Flask-3.x-green.svg)](https://flask.palletsprojects.com/)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://react.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## ✨ What's in v2

| Area | Highlights |
| --- | --- |
| **Landing page** | Animated hero with a *live* in-page classifier, stats band, feature grid, breed spotlight scroller, API teaser, FAQ, CTA |
| **Classify studio** | Drag & drop, file picker, clipboard paste, camera capture, URL mode, batch mode (≤16 images), top-N control, confidence bars, history, JSON/CSV export |
| **Encyclopedia** | 26 researched breed profiles (origin, coat, horns, milk yield, fat %, traits, conservation status) with search + species/utility filters |
| **API** | Versioned `/api/v1/*` JSON API: predict, batch, breeds, classes, samples, stats, system, health, readiness, Prometheus `/metrics` |
| **API docs page** | Endpoint reference, live in-browser console, response schema, error table, SDK snippets |
| **Model card** | Architecture, training protocol, evaluation metrics, limitations & ethics, citation |
| **UX system** | Dark/light themes, ⌘K command palette, toasts, skeletons, scroll reveals, reduced-motion support, keyboard/a11y friendly, PWA manifest |
| **Security** | Strict CSP, magic-byte validation, EXIF handling, decompression-bomb guard, SSRF-safe URL fetch, per-IP rate limiting, request IDs |
| **Ops** | gunicorn config, Docker multi-stage build, compose + nginx sample, GitHub Actions CI, pytest suite (24 tests) |

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────────────┐
│  React 18 SPA (Vite)  —  landing · studio · encyclopedia · docs │
│  built to static/app/ and served by Flask (single origin)       │
└───────────────────────────┬────────────────────────────────────┘
                            │  JSON / multipart
┌───────────────────────────▼────────────────────────────────────┐
│  Flask app factory (webapp/)                                    │
│  api.py ── /api/v1/* + legacy aliases      security.py ─ SSRF, │
│  factory.py ─ SPA, CSP, CORS, errors       rate limits         │
│  metrics.py ─ Prometheus counters          imaging.py ─ decode │
└───────────────────────────┬────────────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────────────┐
│  Inference engine (engine.py)                                   │
│  • TorchEngine   — ResNet-18 checkpoint (models/*.pth)          │
│  • HeuristicEngine — deterministic coat-colour prior fallback   │
│    (clearly flagged `"demo": true` in every response)           │
└────────────────────────────────────────────────────────────────┘
```

**Graceful degradation:** if `models/cattle_breed_classifier_full_model.pth`
(and PyTorch) are present the trained model serves predictions. Otherwise the
service still boots and every endpoint works against a transparent,
deterministic demo engine — responses always declare which engine answered.

---

## 🚀 Quick start

### Option A — Docker (recommended for production)

```bash
docker compose up --build          # app on :5001, nginx proxy on :8080
# bake PyTorch into the image for real inference:
docker compose build --build-arg WITH_TORCH=1 web
```

### Option B — Local Python + Node

```bash
# 1. backend deps
python3 -m pip install -r requirements.txt        # web service
python3 -m pip install -r requirements-ml.txt     # optional: PyTorch runtime

# 2. front-end build (outputs to static/app/)
cd frontend && npm ci && npm run build && cd ..

# 3. serve
python3 app.py                                    # dev
gunicorn -c gunicorn_conf.py app:app              # prod
```

### Option C — Makefile

```bash
make install && make build && make serve
make test          # 24-test pytest suite
```

### Fetching the trained checkpoint

```bash
python3 scripts/download_model.py     # Google Drive (or your own URLs via env)
```

Place any ResNet-18-shaped checkpoint at
`models/cattle_breed_classifier_full_model.pth` to override.

---

## 📡 API at a glance

```bash
# classify an upload
curl -X POST -F "file=@cow.jpg" "http://localhost:5001/api/v1/predict?top_n=3"

# classify from a URL
curl "http://localhost:5001/api/v1/predict?url=https://…/cow.jpg"

# batch (multipart or JSON)
curl -X POST -F "files=@a.jpg" -F "files=@b.jpg" http://localhost:5001/api/v1/predict/batch

# encyclopedia
curl "http://localhost:5001/api/v1/breeds?species=buffalo&utility=milch"

# ops
curl http://localhost:5001/health
curl http://localhost:5001/metrics
```

Response envelope:

```json
{
  "class": "Gir Cow",
  "predictions": [{ "class": "Gir Cow", "output": 3.41, "prob": 0.812 }],
  "inference_time_ms": 41.3,
  "engine": "resnet18-finetuned",
  "demo": false,
  "breed": { "slug": "gir-cow", "name": "Gir", "species": "cattle", "utility": "milch", "status": "registered" },
  "image": { "width": 918, "height": 720, "format": "jpeg", "downscaled": false }
}
```

Errors: `{ "error", "code", "request_id" }` with proper HTTP statuses
(400 / 404 / 413 / 429 / 500). Rate limit: 60 prediction req/min/IP by default
(`Retry-After` on 429). Full reference in-app at **/docs**.

---

## 🧠 Model

| Detail | Value |
| --- | --- |
| Architecture | ResNet-18 (ImageNet init) + 26-way head |
| Input | 224×224 RGB, ImageNet normalisation |
| Dataset | ~4,000 images / 26 indigenous breeds (~150 per class) |
| Training | 25 epochs, Adam, step decay (see `notebooks/` and `src/train.py`) |
| Validation | ~89% top-1, ~96% top-3 (see Model Card page) |
| Fallback | Deterministic coat-colour prior (`"demo": true`) when no checkpoint |

---

## 🗂️ Repository layout

```
app.py                  # entrypoint (create_app + dev server)
webapp/                 # Flask package: factory, api, engine, imaging, security, metrics
frontend/               # React 18 + Vite SPA (src/, public/, vite.config.js)
static/app/             # built front-end bundle (commit-ready; regenerate with npm run build)
static/dataset/         # bundled real reference photos + manifest (credits)
data/breeds.json        # encyclopedia dataset (26 breeds)
models/classes.txt      # class order
src/, notebooks/        # training code & original Colab notebook
tests/                  # pytest suite
scripts/download_model.py
Dockerfile, docker-compose.yml, nginx.conf, gunicorn_conf.py, Procfile, Makefile
.github/workflows/ci.yml
```

---

## 🔐 Configuration

Everything is env-overridable (see `.env.example`): `PORT`, `TOP_N_PREDICTIONS`,
`CONFIDENCE_THRESHOLD`, `MAX_FILE_SIZE_MB`, `BATCH_MAX_IMAGES`,
`RATE_LIMIT_*`, `ALLOWED_ORIGINS`, `EXPORT_FILE_URL`, …

---

## 🧪 Tests & CI

```bash
python3 -m pytest -q     # 24 tests: API contract, security, engine, imaging
```

GitHub Actions runs the backend suite (with a front-end build) and a
front-end build on every push/PR.

---

## 🙏 Credits & license

Created by [Ajit Kumar Singh](https://sajit9285.github.io/myportfolio).
MIT licensed — see [LICENSE](LICENSE). Breed descriptors compiled from NBAGR
registrations and ICAR/livestock literature; landrace entries are labelled as
such where formal documentation is limited.
