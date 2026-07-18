from uuid import UUID

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from kahucik_api.auth.sessions import require_user
from kahucik_api.config import Settings, get_settings
from kahucik_api.db import get_db
from kahucik_api.media.storage import media_url, process_and_store_upload
from kahucik_api.models.entities import MediaAsset, User
from kahucik_api.schemas.quiz import MediaOut

router = APIRouter(prefix="/api/media", tags=["media"])


@router.post("/upload", response_model=MediaOut)
async def upload(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
    settings: Settings = Depends(get_settings),
) -> MediaOut:
    asset = await process_and_store_upload(db, user.id, file, settings)
    await db.commit()
    return MediaOut(
        id=asset.id,
        url=media_url(asset, settings),
        content_type=asset.content_type,
        width=asset.width,
        height=asset.height,
        byte_size=asset.byte_size,
    )


@router.get("/{media_id}", response_model=MediaOut)
async def get_media(
    media_id: UUID,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> MediaOut:
    result = await db.execute(select(MediaAsset).where(MediaAsset.id == media_id))
    asset = result.scalar_one_or_none()
    if asset is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Not found")
    return MediaOut(
        id=asset.id,
        url=media_url(asset, settings),
        content_type=asset.content_type,
        width=asset.width,
        height=asset.height,
        byte_size=asset.byte_size,
    )
