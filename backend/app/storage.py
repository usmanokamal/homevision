from functools import lru_cache
from io import BytesIO
from pathlib import Path

import boto3
from botocore.config import Config as BotoConfig

from .config import settings


class StorageBackend:
    def save_bytes(self, key: str, data: bytes, content_type: str) -> str:
        raise NotImplementedError

    def read_bytes(self, key: str) -> tuple[bytes, str]:
        raise NotImplementedError


class LocalStorageBackend(StorageBackend):
    def __init__(self, root_dir: Path) -> None:
        self.root_dir = root_dir
        self.root_dir.mkdir(parents=True, exist_ok=True)

    def save_bytes(self, key: str, data: bytes, content_type: str) -> str:
        destination = self.root_dir / key
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
        return key

    def read_bytes(self, key: str) -> tuple[bytes, str]:
        source = self.root_dir / key
        return source.read_bytes(), _content_type_from_key(key)


class S3StorageBackend(StorageBackend):
    def __init__(self) -> None:
        self.bucket_name = settings.storage_bucket_name
        self.client = boto3.client(
            "s3",
            region_name=settings.storage_region or None,
            endpoint_url=settings.storage_endpoint_url or None,
            aws_access_key_id=settings.storage_access_key_id or None,
            aws_secret_access_key=settings.storage_secret_access_key or None,
            config=BotoConfig(signature_version="s3v4"),
        )

    def save_bytes(self, key: str, data: bytes, content_type: str) -> str:
        self.client.upload_fileobj(
            BytesIO(data),
            self.bucket_name,
            key,
            ExtraArgs={"ContentType": content_type},
        )
        return key

    def read_bytes(self, key: str) -> tuple[bytes, str]:
        response = self.client.get_object(Bucket=self.bucket_name, Key=key)
        content_type = response.get("ContentType", _content_type_from_key(key))
        return response["Body"].read(), content_type


def _content_type_from_key(key: str) -> str:
    lowered = key.lower()
    if lowered.endswith(".png"):
        return "image/png"
    if lowered.endswith(".webp"):
        return "image/webp"
    return "image/jpeg"


@lru_cache(maxsize=1)
def get_storage() -> StorageBackend:
    if settings.storage_backend == "s3":
        if not settings.storage_bucket_name:
            raise RuntimeError("STORAGE_BUCKET_NAME is required for s3 storage.")
        return S3StorageBackend()
    return LocalStorageBackend(settings.local_storage_dir)
