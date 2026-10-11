"""Gunicorn production configuration.

Usage:  gunicorn -c gunicorn_conf.py app:app
"""

import multiprocessing
import os

bind = f"0.0.0.0:{os.getenv('PORT', '5001')}"
workers = int(os.getenv("WEB_CONCURRENCY", min(4, (multiprocessing.cpu_count() or 1) * 2 + 1)))
threads = int(os.getenv("GUNICORN_THREADS", 4))
worker_class = "gthread"
timeout = int(os.getenv("GUNICORN_TIMEOUT", 60))
graceful_timeout = 20
keepalive = 5
max_requests = 500
max_requests_jitter = 50
accesslog = "-"
errorlog = "-"
loglevel = os.getenv("LOG_LEVEL", "info")
proc_name = "cattle-breed-classifier"
forwarded_allow_ips = "*"
