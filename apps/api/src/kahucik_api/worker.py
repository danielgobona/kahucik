from __future__ import annotations

import asyncio
import logging
import time
import uuid

from kahucik_api.config import get_settings
from kahucik_api.db import SessionLocal
from kahucik_api.game import engine, state as gs
from kahucik_api.models.entities import GameStatus
from kahucik_api.redis_client import close_redis, get_redis

logger = logging.getLogger("kahucik.worker")


async def process_due_games() -> None:
    r = await get_redis()
    now = time.time()
    due = await r.zrangebyscore(gs.DEADLINE_ZSET, min=0, max=now)
    for game_id in due:
        if not await gs.acquire_lock(r, game_id, ttl_ms=8000):
            continue
        try:
            live = await gs.load_live(r, game_id)
            if not live:
                await gs.clear_deadline(r, game_id)
                continue
            status = live.get("status")
            async with SessionLocal() as db:
                game = await engine.get_game(db, uuid.UUID(game_id))
                if status == GameStatus.COUNTDOWN.value and game.status == GameStatus.COUNTDOWN:
                    await engine.open_question(db, r, game, 0)
                    await db.commit()
                elif (
                    status == GameStatus.QUESTION_ACTIVE.value
                    and game.status == GameStatus.QUESTION_ACTIVE
                ):
                    # already_locked=True: we hold the game lock; close_question must not NX-acquire again
                    await engine.close_question(
                        db, r, game, reason="timeout", already_locked=True
                    )
                    await db.commit()
                else:
                    await gs.clear_deadline(r, game_id)
        except Exception:  # noqa: BLE001
            logger.exception("Failed processing deadline for %s", game_id)
        finally:
            await gs.release_lock(r, game_id)


async def run_worker() -> None:
    logging.basicConfig(level=logging.INFO)
    settings = get_settings()
    logger.info("Game worker starting (%s)", settings.environment)
    while True:
        try:
            await process_due_games()
        except Exception:  # noqa: BLE001
            logger.exception("Worker loop error")
        await asyncio.sleep(0.25)


def main() -> None:
    try:
        asyncio.run(run_worker())
    finally:
        asyncio.run(close_redis())


if __name__ == "__main__":
    main()
