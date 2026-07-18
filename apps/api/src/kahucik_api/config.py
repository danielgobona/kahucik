from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Kahúcik"
    environment: str = "development"
    public_base_url: str = "http://localhost:8080"
    secret_key: str = "change-me-in-production-use-a-long-random-string"
    csrf_cookie_name: str = "kahucik_csrf"
    session_cookie_name: str = "kahucik_session"
    session_ttl_seconds: int = 60 * 60 * 24 * 14
    guest_token_ttl_seconds: int = 60 * 60 * 12

    database_url: str = "postgresql+asyncpg://kahucik:kahucik@localhost:5432/kahucik"
    redis_url: str = "redis://localhost:6379/0"

    media_backend: str = "local"  # local | s3
    media_local_path: Path = Path("./data/media")
    media_max_bytes: int = 5 * 1024 * 1024
    media_public_prefix: str = "/media"
    s3_endpoint_url: str | None = None
    s3_bucket: str = "kahucik"
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_region: str = "us-east-1"
    s3_public_base_url: str | None = None

    cors_origins: str = "http://localhost:3000,http://localhost:8080"
    max_players_per_game: int = 100
    game_code_length: int = 6
    countdown_seconds: int = 3

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
