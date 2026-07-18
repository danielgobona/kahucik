from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse
from fastapi.staticfiles import StaticFiles

from kahucik_api.config import get_settings
from kahucik_api.middleware.rate_limit import SimpleRateLimitMiddleware
from kahucik_api.redis_client import close_redis
from kahucik_api.routers import auth, games, media, quizzes
from kahucik_api.ws.handler import router as ws_router


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    if settings.media_backend == "local":
        settings.media_local_path.mkdir(parents=True, exist_ok=True)
    yield
    await close_redis()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        default_response_class=ORJSONResponse,
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(SimpleRateLimitMiddleware, limit=120, window_seconds=60)

    @app.get("/api/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(auth.router)
    app.include_router(quizzes.router)
    app.include_router(media.router)
    app.include_router(games.router)
    app.include_router(ws_router)

    if settings.media_backend == "local":
        media_path = Path(settings.media_local_path)
        try:
            media_path.mkdir(parents=True, exist_ok=True)
            app.mount("/media", StaticFiles(directory=str(media_path)), name="media")
        except OSError:
            # Media directory may be unavailable at import time in some environments.
            pass

    return app


app = create_app()
