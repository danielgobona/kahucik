# Kahúcik

Self-hosted live quiz platform inspired by Kahoot — FastAPI + Next.js + PostgreSQL + Redis, packaged with Docker Compose.

## Quick start

```bash
cp .env.example .env
docker compose up --build
```

Open [http://localhost:8080](http://localhost:8080).

If you are in WSL and `docker` cannot reach the daemon, use Docker Desktop’s Windows CLI:

```bash
docker.exe compose up --build -d
# or: make DOCKER=docker.exe up
```

Also enable **Settings → Resources → WSL integration** for your distro so native `docker` works.

### Testing tip: host + player in one browser

Auth uses a single shared cookie session per browser profile. Logging out in a player tab also logs out the host tab. For local testing, use a normal window for the host and a private/incognito window for players (or two different browsers).

## Stack

| Service | Role |
|---------|------|
| Caddy | Single-origin gateway (`/`, `/api`, `/ws`, `/media`) |
| web | Next.js UI (EN/SK) |
| api | FastAPI REST + WebSockets |
| worker | Question deadline engine |
| db | PostgreSQL 17 |
| redis | Live state, pub/sub, deadlines |

## Local development

### API

```bash
cd apps/api
uv sync
# start postgres + redis (compose) then:
export DATABASE_URL=postgresql+asyncpg://kahucik:kahucik@localhost:5432/kahucik
export REDIS_URL=redis://localhost:6379/0
uv run alembic upgrade head
uv run uvicorn kahucik_api.main:app --reload --port 8000
uv run python -m kahucik_api.worker
```

### Web

```bash
cd apps/web
npm install
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run dev
```

## Features (v1)

- Registered accounts (nickname + email + password, no email verification)
- Guest join per game
- Quiz editor: quiz, true/false, multi-select, puzzle + images
- Host TV flow with QR/code, timers, early close when all answered
- Player mobile flow with locked answers, score, rank
- Global leaderboard for registered users only
- Local media volume or S3-compatible storage

## Load test

1. Host a lobby and set `KAHUCIK_GAME_CODE`.
2. Run Locust with ~100 users:

```bash
pip install locust websocket-client
KAHUCIK_GAME_CODE=ABC123 locust -f loadtest/locustfile.py --host http://localhost:8080
```

Recommended single-server resources for 100 players: 2 vCPU / 4 GB RAM.

## Production notes

- Set a strong `SECRET_KEY` and `POSTGRES_PASSWORD`.
- Set `PUBLIC_BASE_URL` to your public URL.
- For multi-instance media, set `MEDIA_BACKEND=s3` and S3 variables.
- Only expose the Caddy port publicly.
