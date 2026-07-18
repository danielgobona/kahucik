from collections.abc import AsyncGenerator

import redis.asyncio as redis

from kahucik_api.config import get_settings

_pool: redis.Redis | None = None


async def get_redis() -> redis.Redis:
    global _pool
    if _pool is None:
        _pool = redis.from_url(get_settings().redis_url, decode_responses=True)
    return _pool


async def close_redis() -> None:
    global _pool
    if _pool is not None:
        await _pool.aclose()
        _pool = None


async def redis_dep() -> AsyncGenerator[redis.Redis, None]:
    yield await get_redis()
