#!/usr/bin/env bash
# Rebuild and redeploy the full Kahúcik Docker Compose stack.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

resolve_docker() {
  if [[ -n "${DOCKER:-}" ]]; then
    echo "$DOCKER"
    return
  fi
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    echo "docker"
    return
  fi
  # WSL + Docker Desktop: native docker.sock is often missing
  local win_docker="/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe"
  if [[ -x "$win_docker" ]] && "$win_docker" info >/dev/null 2>&1; then
    echo "$win_docker"
    return
  fi
  if command -v docker.exe >/dev/null 2>&1 && docker.exe info >/dev/null 2>&1; then
    echo "docker.exe"
    return
  fi
  echo "error: Docker is not available. Start Docker Desktop or set DOCKER=..." >&2
  exit 1
}

# Prefer Compose V2 plugin ("docker compose"); fall back to standalone docker-compose.
resolve_compose() {
  local docker="$1"
  if [[ -n "${COMPOSE:-}" ]]; then
    # COMPOSE can be a full command string, e.g. "docker compose" or "docker-compose"
    echo "$COMPOSE"
    return
  fi
  if "$docker" compose version >/dev/null 2>&1; then
    echo "$docker compose"
    return
  fi
  if command -v docker-compose >/dev/null 2>&1; then
    echo "docker-compose"
    return
  fi
  echo "error: Docker Compose is not available." >&2
  echo "  Install the plugin, e.g.:" >&2
  echo "    sudo apt update && sudo apt install -y docker-compose-plugin" >&2
  echo "  Or the standalone binary: sudo apt install -y docker-compose" >&2
  exit 1
}

DOCKER="$(resolve_docker)"
# shellcheck disable=SC2206
COMPOSE_CMD=($(resolve_compose "$DOCKER"))
echo "==> Using Docker CLI: $DOCKER"
echo "==> Using Compose:    ${COMPOSE_CMD[*]}"

if [[ ! -f .env ]]; then
  echo "==> Creating .env from .env.example"
  cp .env.example .env
fi

# shellcheck disable=SC1091
set -a
source .env
set +a

HTTP_PORT="${HTTP_PORT:-8080}"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-http://localhost:${HTTP_PORT}}"

echo "==> Building images"
"${COMPOSE_CMD[@]}" build

echo "==> Starting stack"
"${COMPOSE_CMD[@]}" up -d --remove-orphans

echo "==> Waiting for API health"
ok=0
for _ in $(seq 1 60); do
  if curl -fsS "${PUBLIC_BASE_URL}/api/health" >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 1
done

echo
"${COMPOSE_CMD[@]}" ps
echo

if [[ "$ok" -eq 1 ]]; then
  echo "==> Redeploy OK"
  echo "    App:    ${PUBLIC_BASE_URL}"
  echo "    Health: ${PUBLIC_BASE_URL}/api/health"
else
  echo "==> Stack started but API health check did not pass yet." >&2
  echo "    Check logs: ${COMPOSE_CMD[*]} logs -f api web caddy" >&2
  exit 1
fi
