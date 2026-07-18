.PHONY: up down build logs test-api test-web migrate

# On WSL without /var/run/docker.sock, use: make DOCKER="docker.exe" up
DOCKER ?= docker

up:
	$(DOCKER) compose up --build -d

down:
	$(DOCKER) compose down

build:
	$(DOCKER) compose build

logs:
	$(DOCKER) compose logs -f

migrate:
	$(DOCKER) compose run --rm migrate

test-api:
	cd apps/api && uv run pytest -q

test-web:
	cd apps/web && npm run build
