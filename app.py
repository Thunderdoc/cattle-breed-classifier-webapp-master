"""Indigenous Cattle Breed Classifier — production entrypoint.

Run locally:      python app.py
Run in prod:      gunicorn -c gunicorn_conf.py app:app
"""

from __future__ import annotations

import logging
import sys

from webapp import create_app
from webapp.config import settings

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("cattle-classifier")

app = create_app()


if __name__ == "__main__":
    if "prepare" in sys.argv:
        logger.info("Prepare mode — skipping server start.")
        sys.exit(0)
    logger.info("Serving on http://%s:%d (engine resolves lazily on first request)", settings.host, settings.port)
    app.run(debug=settings.debug, host=settings.host, port=settings.port, threaded=True)
