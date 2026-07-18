from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from kahucik_api.config import Settings, get_settings
from kahucik_api.db import get_db
from kahucik_api.models.entities import SessionToken, User


def new_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def create_session(db: AsyncSession, user: User, settings: Settings) -> tuple[SessionToken, str]:
    raw = new_token()
    csrf = secrets.token_urlsafe(24)
    row = SessionToken(
        user_id=user.id,
        token_hash=hash_token(raw),
        csrf_token=csrf,
        expires_at=datetime.now(UTC) + timedelta(seconds=settings.session_ttl_seconds),
    )
    db.add(row)
    await db.flush()
    return row, raw


def _cookie_secure(settings: Settings) -> bool:
    # Only mark Secure when the public app URL is HTTPS. Local HTTP Compose
    # (ENVIRONMENT=production) must still allow JS-readable CSRF cookies.
    return settings.public_base_url.lower().startswith("https://")


def set_session_cookies(response: Response, raw_token: str, csrf: str, settings: Settings) -> None:
    secure = _cookie_secure(settings)
    response.set_cookie(
        settings.session_cookie_name,
        raw_token,
        httponly=True,
        samesite="lax",
        secure=secure,
        max_age=settings.session_ttl_seconds,
        path="/",
    )
    response.set_cookie(
        settings.csrf_cookie_name,
        csrf,
        httponly=False,
        samesite="lax",
        secure=secure,
        max_age=settings.session_ttl_seconds,
        path="/",
    )


def clear_session_cookies(response: Response, settings: Settings) -> None:
    secure = _cookie_secure(settings)
    response.delete_cookie(settings.session_cookie_name, path="/", secure=secure, samesite="lax")
    response.delete_cookie(settings.csrf_cookie_name, path="/", secure=secure, samesite="lax")


async def get_session_user(
    db: AsyncSession,
    settings: Settings,
    session_value: str | None,
) -> tuple[User, SessionToken] | None:
    if not session_value:
        return None
    result = await db.execute(
        select(SessionToken)
        .options(selectinload(SessionToken.user))
        .where(
            SessionToken.token_hash == hash_token(session_value),
            SessionToken.revoked_at.is_(None),
            SessionToken.expires_at > datetime.now(UTC),
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        return None
    return row.user, row


async def require_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    session_cookie: str | None = Cookie(default=None, alias="kahucik_session"),
) -> User:
    settings = get_settings()
    pair = await get_session_user(db, settings, session_cookie)
    if pair is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    user, session = pair
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        csrf_header = request.headers.get("X-CSRF-Token")
        if not csrf_header or csrf_header != session.csrf_token:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF validation failed")
    return user


async def optional_user(
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    session_cookie: str | None = Cookie(default=None, alias="kahucik_session"),
) -> User | None:
    pair = await get_session_user(db, settings, session_cookie)
    return pair[0] if pair else None


async def revoke_session(db: AsyncSession, user_id: UUID, session_cookie: str | None) -> None:
    if not session_cookie:
        return
    result = await db.execute(
        select(SessionToken).where(
            SessionToken.user_id == user_id,
            SessionToken.token_hash == hash_token(session_cookie),
        )
    )
    row = result.scalar_one_or_none()
    if row:
        row.revoked_at = datetime.now(UTC)
