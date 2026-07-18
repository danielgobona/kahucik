from __future__ import annotations

import io
import uuid
from abc import ABC, abstractmethod
from pathlib import Path

import boto3
from botocore.client import Config
from fastapi import HTTPException, UploadFile, status
from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession

from kahucik_api.config import Settings, get_settings
from kahucik_api.models.entities import MediaAsset

ALLOWED = {"image/jpeg", "image/png", "image/webp"}


class StorageBackend(ABC):
    @abstractmethod
    async def save(self, key: str, data: bytes, content_type: str) -> None: ...

    @abstractmethod
    def public_url(self, key: str) -> str: ...

    @abstractmethod
    async def delete(self, key: str) -> None: ...


class LocalStorage(StorageBackend):
    def __init__(self, root: Path, public_prefix: str, public_base_url: str) -> None:
        self.root = root
        self.public_prefix = public_prefix.rstrip("/")
        self.public_base_url = public_base_url.rstrip("/")
        self.root.mkdir(parents=True, exist_ok=True)

    async def save(self, key: str, data: bytes, content_type: str) -> None:
        path = self.root / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def public_url(self, key: str) -> str:
        return f"{self.public_base_url}{self.public_prefix}/{key}"

    async def delete(self, key: str) -> None:
        path = self.root / key
        if path.exists():
            path.unlink()


class S3Storage(StorageBackend):
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url or None,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            region_name=settings.s3_region,
            config=Config(signature_version="s3v4"),
        )
        self.bucket = settings.s3_bucket

    async def save(self, key: str, data: bytes, content_type: str) -> None:
        self.client.put_object(Bucket=self.bucket, Key=key, Body=data, ContentType=content_type)

    def public_url(self, key: str) -> str:
        if self.settings.s3_public_base_url:
            return f"{self.settings.s3_public_base_url.rstrip('/')}/{key}"
        return f"{self.settings.public_base_url}/media/{key}"

    async def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)


def get_storage(settings: Settings | None = None) -> StorageBackend:
    settings = settings or get_settings()
    if settings.media_backend == "s3":
        return S3Storage(settings)
    return LocalStorage(settings.media_local_path, settings.media_public_prefix, settings.public_base_url)


async def process_and_store_upload(
    db: AsyncSession,
    owner_id: uuid.UUID,
    file: UploadFile,
    settings: Settings | None = None,
) -> MediaAsset:
    settings = settings or get_settings()
    if file.content_type not in ALLOWED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported image type")
    raw = await file.read()
    if len(raw) > settings.media_max_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File too large")
    try:
        image = Image.open(io.BytesIO(raw))
        image.load()
        image = image.convert("RGBA")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid image") from exc

    max_side = 1600
    image.thumbnail((max_side, max_side))
    out = io.BytesIO()
    image.save(out, format="WEBP", quality=85)
    data = out.getvalue()
    key = f"{owner_id}/{uuid.uuid4()}.webp"
    storage = get_storage(settings)
    await storage.save(key, data, "image/webp")
    asset = MediaAsset(
        owner_id=owner_id,
        storage_key=key,
        content_type="image/webp",
        width=image.width,
        height=image.height,
        byte_size=len(data),
    )
    db.add(asset)
    await db.flush()
    return asset


def media_url(asset: MediaAsset, settings: Settings | None = None) -> str:
    return get_storage(settings).public_url(asset.storage_key)
