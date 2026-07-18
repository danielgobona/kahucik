from __future__ import annotations

import json
from typing import Any

import redis.asyncio as redis

LIVE_PREFIX = "game:live:"
DEADLINE_ZSET = "game:deadlines"
CHANNEL_PREFIX = "game:channel:"
LIVE_TTL_SECONDS = 60 * 60 * 48  # 48h — covers abandoned lobbies without leaking forever
FINISHED_TTL_SECONDS = 60 * 60 * 6
ANSWER_IDEMPOTENCY_TTL = 60 * 60 * 6


def live_key(game_id: str) -> str:
    return f"{LIVE_PREFIX}{game_id}"


def channel_key(game_id: str) -> str:
    return f"{CHANNEL_PREFIX}{game_id}"


def answer_key(game_id: str, participant_id: str, question_id: str) -> str:
    return f"game:answer:{game_id}:{participant_id}:{question_id}"


async def save_live(
    r: redis.Redis,
    game_id: str,
    state: dict[str, Any],
    *,
    ttl: int = LIVE_TTL_SECONDS,
) -> None:
    await r.set(live_key(game_id), json.dumps(state), ex=ttl)


async def load_live(r: redis.Redis, game_id: str) -> dict[str, Any] | None:
    raw = await r.get(live_key(game_id))
    return json.loads(raw) if raw else None


async def delete_live(r: redis.Redis, game_id: str) -> None:
    await r.delete(live_key(game_id))
    await r.zrem(DEADLINE_ZSET, game_id)


async def schedule_deadline(r: redis.Redis, game_id: str, deadline_ts: float) -> None:
    await r.zadd(DEADLINE_ZSET, {game_id: deadline_ts})


async def clear_deadline(r: redis.Redis, game_id: str) -> None:
    await r.zrem(DEADLINE_ZSET, game_id)


async def publish_event(r: redis.Redis, game_id: str, event: dict[str, Any]) -> None:
    await r.publish(channel_key(game_id), json.dumps(event))


async def acquire_lock(r: redis.Redis, game_id: str, ttl_ms: int = 5000) -> bool:
    return bool(await r.set(f"game:lock:{game_id}", "1", nx=True, px=ttl_ms))


async def release_lock(r: redis.Redis, game_id: str) -> None:
    await r.delete(f"game:lock:{game_id}")


async def claim_answer_slot(
    r: redis.Redis, game_id: str, participant_id: str, question_id: str
) -> bool:
    return bool(
        await r.set(
            answer_key(game_id, participant_id, question_id),
            "1",
            nx=True,
            ex=ANSWER_IDEMPOTENCY_TTL,
        )
    )
