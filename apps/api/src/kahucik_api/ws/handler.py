from __future__ import annotations

import asyncio
import json
import uuid
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from kahucik_api.auth.sessions import get_session_user, hash_token
from kahucik_api.config import get_settings
from kahucik_api.db import SessionLocal
from kahucik_api.game import engine, state as gs
from kahucik_api.models.entities import GameParticipant
from kahucik_api.redis_client import get_redis

router = APIRouter()


async def _read_json(ws: WebSocket) -> dict[str, Any]:
    data = await ws.receive_text()
    return json.loads(data)


@router.websocket("/ws/games/{game_id}")
async def game_ws(websocket: WebSocket, game_id: uuid.UUID) -> None:
    await websocket.accept()
    settings = get_settings()
    r = await get_redis()
    role = "spectator"
    participant_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None
    pubsub = r.pubsub()
    await pubsub.subscribe(gs.channel_key(str(game_id)))

    try:
        hello = await asyncio.wait_for(_read_json(websocket), timeout=15)
        async with SessionLocal() as db:
            game = await engine.get_game(db, game_id)
            if hello.get("type") == "host_hello":
                cookie = websocket.cookies.get(settings.session_cookie_name)
                pair = await get_session_user(db, settings, cookie)
                if pair is None or pair[0].id != game.host_id:
                    await websocket.send_json({"type": "error", "payload": {"detail": "Unauthorized host"}})
                    await websocket.close()
                    return
                role = "host"
                user_id = pair[0].id
            elif hello.get("type") == "player_hello":
                token = hello.get("payload", {}).get("reconnect_token")
                if not token:
                    await websocket.send_json({"type": "error", "payload": {"detail": "Missing token"}})
                    await websocket.close()
                    return
                result = await db.execute(
                    select(GameParticipant).where(
                        GameParticipant.game_id == game_id,
                        GameParticipant.reconnect_token_hash == hash_token(token),
                    )
                )
                participant = result.scalar_one_or_none()
                if participant is None:
                    await websocket.send_json({"type": "error", "payload": {"detail": "Invalid token"}})
                    await websocket.close()
                    return
                participant.connected = True
                await db.commit()
                role = "player"
                participant_id = participant.id
            else:
                await websocket.send_json({"type": "error", "payload": {"detail": "Unknown hello"}})
                await websocket.close()
                return

            snap = await engine.snapshot_for(db, r, game, role=role, participant_id=participant_id)
            await websocket.send_json({"type": "snapshot", "payload": snap})

        async def reader() -> None:
            nonlocal participant_id
            while True:
                msg = await _read_json(websocket)
                mtype = msg.get("type")
                payload = msg.get("payload", {})
                async with SessionLocal() as db:
                    game = await engine.get_game(db, game_id)
                    try:
                        if role == "host":
                            if mtype == "start":
                                await engine.host_start(db, r, game, user_id)  # type: ignore[arg-type]
                                await db.commit()
                            elif mtype == "show_leaderboard":
                                await engine.host_show_leaderboard(db, r, game, user_id)  # type: ignore[arg-type]
                                await db.commit()
                            elif mtype == "next":
                                await engine.host_next(db, r, game, user_id)  # type: ignore[arg-type]
                                await db.commit()
                            elif mtype == "ping":
                                await websocket.send_json({"type": "pong", "payload": {}})
                        elif role == "player":
                            if mtype == "answer" and participant_id:
                                p = await db.get(GameParticipant, participant_id)
                                if p is None:
                                    raise ValueError("Participant missing")
                                result = await engine.submit_answer(db, r, game, p, payload)
                                await db.commit()
                                await websocket.send_json({"type": "answer_ack", "payload": result})
                            elif mtype == "ping":
                                await websocket.send_json({"type": "pong", "payload": {}})
                    except Exception as exc:  # noqa: BLE001
                        await db.rollback()
                        await websocket.send_json(
                            {"type": "error", "payload": {"detail": str(getattr(exc, "detail", exc))}}
                        )

        async def fanout() -> None:
            async for message in pubsub.listen():
                if message.get("type") != "message":
                    continue
                data = message["data"]
                if isinstance(data, bytes):
                    data = data.decode()
                event = json.loads(data)
                # Filter answer_locked noise for others
                if event.get("type") == "answer_locked" and role == "player":
                    if event.get("payload", {}).get("participant_id") != str(participant_id):
                        continue
                await websocket.send_json(event)

        await asyncio.gather(reader(), fanout())
    except (WebSocketDisconnect, TimeoutError, asyncio.CancelledError):
        pass
    finally:
        if participant_id:
            async with SessionLocal() as db:
                p = await db.get(GameParticipant, participant_id)
                if p:
                    p.connected = False
                    await db.commit()
                    await gs.publish_event(
                        r,
                        str(game_id),
                        {
                            "type": "lobby_update",
                            "payload": {"participant_disconnected": str(participant_id)},
                        },
                    )
        await pubsub.unsubscribe(gs.channel_key(str(game_id)))
        await pubsub.aclose()
