.PHONY: install install-ml build serve dev test lint clean

install:            ## python deps for the web service
	python3 -m pip install -r requirements.txt

install-ml:         ## + PyTorch runtime for real inference
	python3 -m pip install -r requirements-ml.txt

build:              ## build the React front-end into static/app
	cd frontend && npm ci --no-audit --no-fund && npm run build

serve:              ## run the production server (gunicorn)
	gunicorn -c gunicorn_conf.py app:app

dev:                ## run flask dev server + vite dev server with proxy
	python3 app.py &
	cd frontend && npm run dev

test:               ## backend test-suite
	python3 -m pytest -q

clean:
	rm -rf static/app frontend/node_modules .pytest_cache
