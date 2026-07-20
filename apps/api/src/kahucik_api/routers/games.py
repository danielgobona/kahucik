from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

import redis.asyncio as redis

from kahucik_api.auth.sessions import require_user
from kahucik_api.config import Settings, get_settings
from kahucik_api.db import get_db
from kahucik_api.game import engine
from kahucik_api.models.entities import User
from kahucik_api.redis_client import redis_dep
from kahucik_api.schemas.common import Page
from kahucik_api.schemas.game import (
    GameHistoryItem,
    GameOut,
    HostGameRequest,
    JoinGuestRequest,
    JoinRegisteredRequest,
    JoinResponse,
    LeaderboardEntry,
)
from kahucik_api.services.quiz_service import get_owned_quiz

router = APIRouter(prefix="/api/games", tags=["games"])


def _game_out(game, settings: Settings) -> GameOut:
    return GameOut(
        id=game.id,
        code=game.code,
        status=game.status.value,
        quiz_title=game.quiz_snapshot.get("title", ""),
        current_question_index=game.current_question_index,
        participant_count=len(game.participants),
        join_url=f"{settings.public_base_url}/join/{game.code}",
        created_at=game.created_at,
    )


@router.post("/host", response_model=GameOut)
async def host_game(
    body: HostGameRequest,
    db: AsyncSession = Depends(get_db),
    r: redis.Redis = Depends(redis_dep),
    user: User = Depends(require_user),
    settings: Settings = Depends(get_settings),
) -> GameOut:
    quiz = await get_owned_quiz(db, body.quiz_id, user.id)
    game = await engine.create_game(db, user, quiz, settings)
    await db.commit()
    game = await engine.get_game(db, game.id)
    await engine.ensure_live_state(r, game)
    return _game_out(game, settings)


@router.get("/meta/leaderboard", response_model=list[LeaderboardEntry])
async def leaderboard(db: AsyncSession = Depends(get_db)) -> list[LeaderboardEntry]:
    rows = await engine.global_leaderboard(db)
    return [LeaderboardEntry(**row) for row in rows]


@router.get("/meta/history", response_model=Page[GameHistoryItem])
async def history(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
) -> Page[GameHistoryItem]:
    rows, total = await engine.user_history(
        db, user.id, limit=limit, offset=offset
    )
    return Page(
        items=[GameHistoryItem(**row) for row in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/code/{code}", response_model=GameOut)
async def get_by_code(
    code: str,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> GameOut:
    game = await engine.get_game_by_code(db, code)
    return _game_out(game, settings)


@router.post("/code/{code}/join/guest", response_model=JoinResponse)
async def join_guest(
    code: str,
    body: JoinGuestRequest,
    db: AsyncSession = Depends(get_db),
    r: redis.Redis = Depends(redis_dep),
) -> JoinResponse:
    game = await engine.get_game_by_code(db, code)
    participant, token = await engine.join_game(db, r, game, body.nickname, user=None)
    await db.commit()
    return JoinResponse(
        game_id=game.id,
        participant_id=participant.id,
        reconnect_token=token,
        nickname=participant.nickname,
        is_guest=True,
    )


@router.post("/code/{code}/join", response_model=JoinResponse)
async def join_registered(
    code: str,
    body: JoinRegisteredRequest,
    db: AsyncSession = Depends(get_db),
    r: redis.Redis = Depends(redis_dep),
    user: User = Depends(require_user),
) -> JoinResponse:
    game = await engine.get_game_by_code(db, code)
    participant, token = await engine.join_game(db, r, game, user.nickname, user=user)
    await db.commit()
    return JoinResponse(
        game_id=game.id,
        participant_id=participant.id,
        reconnect_token=token,
        nickname=participant.nickname,
        is_guest=False,
    )


@router.get("/{game_id}", response_model=GameOut)
async def get_game(
    game_id: UUID,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> GameOut:
    game = await engine.get_game(db, game_id)
    return _game_out(game, settings)
