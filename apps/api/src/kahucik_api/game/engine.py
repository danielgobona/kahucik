from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime
from typing import Any

import redis.asyncio as redis
from fastapi import HTTPException
from sqlalchemy import case, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from kahucik_api.auth.sessions import hash_token, new_token
from kahucik_api.config import Settings, get_settings
from kahucik_api.game import state as gs
from kahucik_api.models.entities import (
    Game,
    GameParticipant,
    GameResult,
    GameStatus,
    Quiz,
    QuizStatus,
    Submission,
    User,
)
from kahucik_api.services.normalize import normalize_nickname, validate_nickname
from kahucik_api.services.quiz_service import correct_map, public_question, quiz_snapshot
from kahucik_api.services.scoring import score_answer


def _gen_code(length: int = 6) -> str:
    alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
    return "".join(secrets.choice(alphabet) for _ in range(length))


async def create_game(db: AsyncSession, host: User, quiz: Quiz, settings: Settings | None = None) -> Game:
    settings = settings or get_settings()
    if quiz.status != QuizStatus.PUBLISHED:
        raise HTTPException(status_code=400, detail="Only published quizzes can be hosted")
    if not quiz.questions:
        raise HTTPException(status_code=400, detail="Quiz has no questions")

    # Cancel any previous lobby games for this host
    existing = await db.execute(
        select(Game).where(Game.host_id == host.id, Game.status == GameStatus.LOBBY)
    )
    for g in existing.scalars().all():
        g.status = GameStatus.CANCELLED

    for _ in range(20):
        code = _gen_code(settings.game_code_length)
        taken = await db.execute(select(Game.id).where(Game.code == code))
        if taken.scalar_one_or_none() is None:
            break
    else:
        raise HTTPException(status_code=500, detail="Could not allocate game code")

    game = Game(
        quiz_id=quiz.id,
        host_id=host.id,
        code=code,
        status=GameStatus.LOBBY,
        quiz_snapshot=quiz_snapshot(quiz),
        current_question_index=-1,
    )
    db.add(game)
    await db.flush()
    return game


async def get_game_by_code(db: AsyncSession, code: str) -> Game:
    result = await db.execute(
        select(Game)
        .options(selectinload(Game.participants))
        .where(Game.code == code.upper())
    )
    game = result.scalar_one_or_none()
    if game is None:
        raise HTTPException(status_code=404, detail="Game not found")
    return game


async def get_game(db: AsyncSession, game_id: uuid.UUID) -> Game:
    result = await db.execute(
        select(Game).options(selectinload(Game.participants)).where(Game.id == game_id)
    )
    game = result.scalar_one_or_none()
    if game is None:
        raise HTTPException(status_code=404, detail="Game not found")
    return game


async def join_game(
    db: AsyncSession,
    r: redis.Redis,
    game: Game,
    nickname: str,
    *,
    user: User | None = None,
    settings: Settings | None = None,
) -> tuple[GameParticipant, str]:
    settings = settings or get_settings()
    if game.status != GameStatus.LOBBY:
        raise HTTPException(status_code=400, detail="Game already started")
    active = [p for p in game.participants]
    if len(active) >= settings.max_players_per_game:
        raise HTTPException(status_code=400, detail="Game is full")

    if user is not None:
        nickname = user.nickname
        # Replace previous join for same registered user
        for p in list(game.participants):
            if p.user_id == user.id:
                await db.delete(p)
                await db.flush()
                game.participants = [x for x in game.participants if x.id != p.id]
                break
    else:
        try:
            nickname = validate_nickname(nickname)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    nick_norm = normalize_nickname(nickname)
    for p in game.participants:
        if p.nickname_normalized == nick_norm and (user is None or p.user_id != user.id):
            raise HTTPException(status_code=409, detail="Nickname already taken in this lobby")

    raw = new_token()
    join_order = (max((p.join_order for p in game.participants), default=0)) + 1
    participant = GameParticipant(
        game_id=game.id,
        user_id=user.id if user else None,
        nickname=nickname,
        nickname_normalized=nick_norm,
        is_guest=user is None,
        reconnect_token_hash=hash_token(raw),
        join_order=join_order,
        connected=True,
    )
    db.add(participant)
    await db.flush()
    await _broadcast(
        r,
        str(game.id),
        {
            "type": "lobby_update",
            "payload": {"participants": _participants_payload(game.participants + [participant])},
        },
    )
    return participant, raw


async def _broadcast(r: redis.Redis, game_id: str, event: dict[str, Any]) -> None:
    await gs.publish_event(r, game_id, event)


def _participants_payload(participants: list[GameParticipant]) -> list[dict[str, Any]]:
    return [
        {
            "id": str(p.id),
            "nickname": p.nickname,
            "is_guest": p.is_guest,
            "score": p.score,
            "connected": p.connected,
            "join_order": p.join_order,
        }
        for p in sorted(participants, key=lambda x: x.join_order)
    ]


def _ranked(participants: list[GameParticipant]) -> list[dict[str, Any]]:
    ordered = sorted(
        participants,
        key=lambda p: (-p.score, p.total_response_ms, p.join_order),
    )
    out = []
    for idx, p in enumerate(ordered, start=1):
        out.append(
            {
                "id": str(p.id),
                "nickname": p.nickname,
                "is_guest": p.is_guest,
                "score": p.score,
                "rank": idx,
                "answers_correct": p.answers_correct,
                "answers_total": p.answers_total,
            }
        )
    return out


async def ensure_live_state(r: redis.Redis, game: Game) -> dict[str, Any]:
    live = await gs.load_live(r, str(game.id))
    if live:
        return live
    live = {
        "game_id": str(game.id),
        "status": game.status.value,
        "current_question_index": game.current_question_index,
        "started_at": None,
        "deadline": None,
        "answered_ids": [],
        "present_ids": [],
    }
    await gs.save_live(r, str(game.id), live)
    return live


async def host_start(db: AsyncSession, r: redis.Redis, game: Game, host_id: uuid.UUID) -> None:
    if game.host_id != host_id:
        raise HTTPException(status_code=403, detail="Only host can start")
    if game.status != GameStatus.LOBBY:
        raise HTTPException(status_code=400, detail="Game not in lobby")
    if not game.participants:
        raise HTTPException(status_code=400, detail="Need at least one player")
    settings = get_settings()
    now = datetime.now(UTC)
    game.status = GameStatus.COUNTDOWN
    game.started_at = now
    await db.flush()
    deadline = now.timestamp() + settings.countdown_seconds
    live = {
        "game_id": str(game.id),
        "status": GameStatus.COUNTDOWN.value,
        "current_question_index": -1,
        "started_at": now.isoformat(),
        "deadline": deadline,
        "answered_ids": [],
        "present_ids": [str(p.id) for p in game.participants],
    }
    await gs.save_live(r, str(game.id), live)
    await gs.schedule_deadline(r, str(game.id), deadline)
    await _broadcast(
        r,
        str(game.id),
        {
            "type": "countdown",
            "payload": {"seconds": settings.countdown_seconds, "deadline": deadline},
        },
    )


async def open_question(db: AsyncSession, r: redis.Redis, game: Game, index: int) -> None:
    questions = game.quiz_snapshot["questions"]
    if index < 0 or index >= len(questions):
        await finish_game(db, r, game)
        return
    q = questions[index]
    now = datetime.now(UTC)
    deadline = now.timestamp() + q["timer_seconds"]
    game.status = GameStatus.QUESTION_ACTIVE
    game.current_question_index = index
    for p in game.participants:
        p.present_at_question_start = True
    await db.flush()
    live = {
        "game_id": str(game.id),
        "status": GameStatus.QUESTION_ACTIVE.value,
        "current_question_index": index,
        "started_at": now.isoformat(),
        "deadline": deadline,
        "answered_ids": [],
        "present_ids": [str(p.id) for p in game.participants],
    }
    await gs.save_live(r, str(game.id), live)
    await gs.schedule_deadline(r, str(game.id), deadline)
    await _broadcast(
        r,
        str(game.id),
        {
            "type": "question",
            "payload": {
                "index": index,
                "total": len(questions),
                "started_at": live["started_at"],
                "deadline": deadline,
                "question": public_question(q, include_answers=False),
            },
        },
    )


async def submit_answer(
    db: AsyncSession,
    r: redis.Redis,
    game: Game,
    participant: GameParticipant,
    payload: dict[str, Any],
) -> dict[str, Any]:
    if game.status != GameStatus.QUESTION_ACTIVE:
        raise HTTPException(status_code=400, detail="No active question")
    live = await ensure_live_state(r, game)
    now = datetime.now(UTC)
    if live.get("deadline") and now.timestamp() > float(live["deadline"]):
        raise HTTPException(status_code=400, detail="Time is up")

    q = game.quiz_snapshot["questions"][game.current_question_index]
    question_id = uuid.UUID(q["id"])
    claimed = await gs.claim_answer_slot(r, str(game.id), str(participant.id), str(question_id))
    if not claimed:
        raise HTTPException(status_code=409, detail="Already answered")

    existing = await db.execute(
        select(Submission).where(
            Submission.game_id == game.id,
            Submission.participant_id == participant.id,
            Submission.question_id == question_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already answered")

    started = datetime.fromisoformat(live["started_at"])
    response_ms = max(int((now - started).total_seconds() * 1000), 0)
    ok, points = score_answer(q["type"], q["timer_seconds"], response_ms, payload, correct_map(q))
    sub = Submission(
        game_id=game.id,
        participant_id=participant.id,
        question_id=question_id,
        payload=payload,
        is_correct=ok,
        points_awarded=points,
        response_ms=response_ms,
    )
    db.add(sub)
    participant.score += points
    participant.total_response_ms += response_ms
    participant.answers_total += 1
    if ok:
        participant.answers_correct += 1
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Already answered") from exc

    answered = set(live.get("answered_ids", []))
    answered.add(str(participant.id))
    live["answered_ids"] = list(answered)
    await gs.save_live(r, str(game.id), live)

    present = set(live.get("present_ids", []))
    await _broadcast(
        r,
        str(game.id),
        {
            "type": "answer_progress",
            "payload": {
                "answered": len(answered),
                "total": len(present) or len(game.participants),
            },
        },
    )
    await _broadcast(
        r,
        str(game.id),
        {
            "type": "answer_locked",
            "payload": {"participant_id": str(participant.id)},
        },
    )

    if present and answered >= present:
        await close_question(db, r, game, reason="all_answered")

    return {"locked": True, "response_ms": response_ms}


async def close_question(
    db: AsyncSession,
    r: redis.Redis,
    game: Game,
    reason: str = "timeout",
    *,
    already_locked: bool = False,
) -> None:
    """Close the active question. Callers own the DB transaction (no commit here).

    When the deadline worker already holds the game lock, pass already_locked=True
    so we do not try to NX-acquire the same lock again (which would silently no-op).
    """
    if not already_locked and not await gs.acquire_lock(r, str(game.id)):
        return
    try:
        game = await get_game(db, game.id)
        if game.status != GameStatus.QUESTION_ACTIVE:
            return
        await gs.clear_deadline(r, str(game.id))
        q = game.quiz_snapshot["questions"][game.current_question_index]
        question_id = uuid.UUID(q["id"])
        subs = await db.execute(
            select(Submission).where(
                Submission.game_id == game.id, Submission.question_id == question_id
            )
        )
        submissions = list(subs.scalars().all())
        by_pid = {str(s.participant_id): s for s in submissions}
        distribution: dict[str, int] = {}
        for s in submissions:
            key = json_key(s.payload)
            distribution[key] = distribution.get(key, 0) + 1

        game.status = GameStatus.QUESTION_REVEAL
        await db.flush()
        live = await ensure_live_state(r, game)
        live["status"] = GameStatus.QUESTION_REVEAL.value
        live["deadline"] = None
        await gs.save_live(r, str(game.id), live)

        leaderboard = _ranked(game.participants)
        rank_map = {e["id"]: e["rank"] for e in leaderboard}
        player_results = []
        for p in game.participants:
            sub = by_pid.get(str(p.id))
            player_results.append(
                {
                    "participant_id": str(p.id),
                    "nickname": p.nickname,
                    "answered": sub is not None,
                    "is_correct": bool(sub.is_correct) if sub else False,
                    "points_awarded": sub.points_awarded if sub else 0,
                    "score": p.score,
                    "rank": rank_map.get(str(p.id), 0),
                    "payload": sub.payload if sub else None,
                }
            )

        await _broadcast(
            r,
            str(game.id),
            {
                "type": "question_reveal",
                "payload": {
                    "reason": reason,
                    "question": public_question(q, include_answers=True),
                    "correct": correct_map(q),
                    "distribution": distribution,
                    "players": player_results,
                    "leaderboard": leaderboard,
                },
            },
        )
    finally:
        if not already_locked:
            await gs.release_lock(r, str(game.id))


def json_key(payload: dict[str, Any]) -> str:
    import json

    return json.dumps(payload, sort_keys=True, default=str)


async def host_show_leaderboard(db: AsyncSession, r: redis.Redis, game: Game, host_id: uuid.UUID) -> None:
    if game.host_id != host_id:
        raise HTTPException(status_code=403, detail="Only host")
    if game.status != GameStatus.QUESTION_REVEAL:
        raise HTTPException(status_code=400, detail="Not in reveal state")
    game.status = GameStatus.LEADERBOARD
    await db.flush()
    live = await ensure_live_state(r, game)
    live["status"] = GameStatus.LEADERBOARD.value
    await gs.save_live(r, str(game.id), live)
    await _broadcast(
        r,
        str(game.id),
        {"type": "leaderboard", "payload": {"leaderboard": _ranked(game.participants)}},
    )


async def host_next(db: AsyncSession, r: redis.Redis, game: Game, host_id: uuid.UUID) -> None:
    if game.host_id != host_id:
        raise HTTPException(status_code=403, detail="Only host")
    if game.status not in {GameStatus.QUESTION_REVEAL, GameStatus.LEADERBOARD}:
        raise HTTPException(status_code=400, detail="Cannot advance now")
    nxt = game.current_question_index + 1
    questions = game.quiz_snapshot["questions"]
    if nxt >= len(questions):
        await finish_game(db, r, game)
        return
    await open_question(db, r, game, nxt)


async def finish_game(db: AsyncSession, r: redis.Redis, game: Game) -> None:
    game.status = GameStatus.FINISHED
    game.finished_at = datetime.now(UTC)
    ranked = _ranked(game.participants)
    existing_rows = await db.execute(select(GameResult).where(GameResult.game_id == game.id))
    for existing in existing_rows.scalars().all():
        await db.delete(existing)
    for entry in ranked:
        p = next(x for x in game.participants if str(x.id) == entry["id"])
        db.add(
            GameResult(
                game_id=game.id,
                participant_id=p.id,
                user_id=p.user_id,
                nickname=p.nickname,
                is_guest=p.is_guest,
                score=p.score,
                rank=entry["rank"],
                answers_correct=p.answers_correct,
                answers_total=p.answers_total,
                total_response_ms=p.total_response_ms,
            )
        )
    await db.flush()
    live = await ensure_live_state(r, game)
    live["status"] = GameStatus.FINISHED.value
    live["deadline"] = None
    await gs.save_live(r, str(game.id), live, ttl=gs.FINISHED_TTL_SECONDS)
    await gs.clear_deadline(r, str(game.id))
    await _broadcast(
        r,
        str(game.id),
        {
            "type": "finished",
            "payload": {
                "leaderboard": ranked,
                "quiz_title": game.quiz_snapshot.get("title", ""),
            },
        },
    )


async def snapshot_for(
    db: AsyncSession,
    r: redis.Redis,
    game: Game,
    *,
    role: str,
    participant_id: uuid.UUID | None = None,
) -> dict[str, Any]:
    live = await ensure_live_state(r, game)
    base: dict[str, Any] = {
        "game_id": str(game.id),
        "code": game.code,
        "status": game.status.value,
        "quiz_title": game.quiz_snapshot.get("title", ""),
        "current_question_index": game.current_question_index,
        "participants": _participants_payload(game.participants),
        "deadline": live.get("deadline"),
        "started_at": live.get("started_at"),
        "answered": len(live.get("answered_ids", [])),
        "total_present": len(live.get("present_ids", [])),
        "total_questions": len(game.quiz_snapshot.get("questions", [])),
        "role": role,
    }
    idx = game.current_question_index
    questions = game.quiz_snapshot.get("questions", [])
    if 0 <= idx < len(questions):
        include = game.status in {
            GameStatus.QUESTION_REVEAL,
            GameStatus.LEADERBOARD,
            GameStatus.FINISHED,
        }
        base["question"] = public_question(questions[idx], include_answers=include)
        if include:
            base["correct"] = correct_map(questions[idx])
            base["leaderboard"] = _ranked(game.participants)
    if role == "player" and participant_id:
        p = next((x for x in game.participants if x.id == participant_id), None)
        if p:
            base["me"] = {
                "id": str(p.id),
                "nickname": p.nickname,
                "score": p.score,
                "is_guest": p.is_guest,
            }
            if 0 <= idx < len(questions):
                qid = uuid.UUID(questions[idx]["id"])
                sub = await db.execute(
                    select(Submission).where(
                        Submission.game_id == game.id,
                        Submission.participant_id == p.id,
                        Submission.question_id == qid,
                    )
                )
                s = sub.scalar_one_or_none()
                if s:
                    base["my_submission"] = {
                        "payload": s.payload,
                        "is_correct": s.is_correct if include else None,
                        "points_awarded": s.points_awarded if include else None,
                        "locked": True,
                    }
                ranks = {e["id"]: e["rank"] for e in _ranked(game.participants)}
                base["my_rank"] = ranks.get(str(p.id))
    if role == "host" or game.status == GameStatus.FINISHED:
        base["leaderboard"] = _ranked(game.participants)
    return base


async def global_leaderboard(db: AsyncSession, limit: int = 50) -> list[dict[str, Any]]:
    wins_expr = func.coalesce(func.sum(case((GameResult.rank == 1, 1), else_=0)), 0)
    rows = await db.execute(
        select(
            User.id,
            User.nickname,
            func.coalesce(func.sum(GameResult.score), 0).label("score"),
            func.count(GameResult.id).label("games_played"),
            wins_expr.label("wins"),
            func.coalesce(func.avg(GameResult.score), 0).label("average_score"),
        )
        .join(GameResult, GameResult.user_id == User.id)
        .where(GameResult.is_guest.is_(False))
        .group_by(User.id, User.nickname)
        .order_by(func.sum(GameResult.score).desc(), User.nickname.asc())
        .limit(limit)
    )
    result = []
    for i, row in enumerate(rows.all(), start=1):
        result.append(
            {
                "user_id": str(row.id),
                "nickname": row.nickname,
                "score": int(row.score),
                "games_played": int(row.games_played),
                "wins": int(row.wins),
                "average_score": round(float(row.average_score), 1),
                "is_guest": False,
                "rank": i,
            }
        )
    return result


async def user_history(db: AsyncSession, user_id: uuid.UUID) -> list[dict[str, Any]]:
    participant_count = (
        select(func.count())
        .select_from(GameParticipant)
        .where(GameParticipant.game_id == Game.id)
        .correlate(Game)
        .scalar_subquery()
    )
    result = await db.execute(
        select(GameResult, Game, participant_count)
        .join(Game, Game.id == GameResult.game_id)
        .where(GameResult.user_id == user_id)
        .order_by(GameResult.created_at.desc())
        .limit(100)
    )
    out = []
    for gr, game, count in result.all():
        out.append(
            {
                "game_id": str(game.id),
                "quiz_title": game.quiz_snapshot.get("title", ""),
                "score": gr.score,
                "rank": gr.rank,
                "answers_correct": gr.answers_correct,
                "answers_total": gr.answers_total,
                "finished_at": game.finished_at.isoformat() if game.finished_at else None,
                "participants": int(count or 0),
            }
        )
    return out
