from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from kahucik_api.auth.passwords import hash_password, verify_password
from kahucik_api.auth.sessions import (
    clear_session_cookies,
    create_session,
    get_session_user,
    require_user,
    revoke_session,
    set_session_cookies,
)
from kahucik_api.config import Settings, get_settings
from kahucik_api.db import get_db
from kahucik_api.models.entities import User
from kahucik_api.schemas.auth import LoginRequest, MeResponse, SignupRequest, UserOut
from kahucik_api.services.normalize import normalize_email, normalize_nickname, validate_nickname

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", response_model=MeResponse)
async def signup(
    body: SignupRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> MeResponse:
    try:
        nickname = validate_nickname(body.nickname)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    email_n = normalize_email(body.email)
    nick_n = normalize_nickname(nickname)
    exists = await db.execute(
        select(User).where((User.email_normalized == email_n) | (User.nickname_normalized == nick_n))
    )
    if exists.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email or nickname already registered")
    user = User(
        nickname=nickname,
        nickname_normalized=nick_n,
        email=body.email.strip(),
        email_normalized=email_n,
        password_hash=hash_password(body.password),
        locale=body.locale,
    )
    db.add(user)
    await db.flush()
    session, raw = await create_session(db, user, settings)
    await db.commit()
    set_session_cookies(response, raw, session.csrf_token, settings)
    return MeResponse(user=UserOut.model_validate(user), csrf_token=session.csrf_token)


@router.post("/login", response_model=MeResponse)
async def login(
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> MeResponse:
    email_n = normalize_email(body.email)
    result = await db.execute(select(User).where(User.email_normalized == email_n))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(user.password_hash, body.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    session, raw = await create_session(db, user, settings)
    await db.commit()
    set_session_cookies(response, raw, session.csrf_token, settings)
    return MeResponse(user=UserOut.model_validate(user), csrf_token=session.csrf_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    session_cookie: str | None = Cookie(default=None, alias="kahucik_session"),
    user: User = Depends(require_user),
) -> None:
    await revoke_session(db, user.id, session_cookie)
    await db.commit()
    clear_session_cookies(response, settings)


@router.get("/me", response_model=MeResponse)
async def me(
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    session_cookie: str | None = Cookie(default=None, alias="kahucik_session"),
) -> MeResponse:
    pair = await get_session_user(db, settings, session_cookie)
    if pair is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user, session = pair
    return MeResponse(user=UserOut.model_validate(user), csrf_token=session.csrf_token)
