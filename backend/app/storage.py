"""Хранилище медиафайлов: локальная папка или S3-совместимое (MinIO).

Выбор бэкенда — `MEDIA_BACKEND=local|s3` в .env. Публичные ссылки всегда
ОТНОСИТЕЛЬНЫЕ (`/media/<имя>`): домен и порт подставляет фронт, поэтому
данные в БД не привязаны к окружению (раньше туда попадал
`http://localhost:8000/...` и после смены порта все картинки ломались).
"""
import logging
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import BinaryIO, Iterable, NamedTuple

from .config import settings

log = logging.getLogger("app.storage")


class StoredFile(NamedTuple):
    name: str
    size: int
    modified: datetime


def public_url(name: str) -> str:
    """Ссылка для сохранения в БД и отдачи фронтам."""
    return f"/media/{name}"


class LocalStorage:
    """Файлы в каталоге на диске (dev по умолчанию, том в docker)."""

    kind = "local"

    def __init__(self, directory: str) -> None:
        self.dir = Path(directory)
        self.dir.mkdir(parents=True, exist_ok=True)

    def path(self, name: str) -> Path:
        return self.dir / name

    def save(self, name: str, data: bytes) -> None:
        self.path(name).write_bytes(data)

    def save_file(self, name: str, src: Path) -> None:
        shutil.copyfile(src, self.path(name))

    def open(self, name: str) -> BinaryIO:
        return self.path(name).open("rb")

    def read(self, name: str) -> bytes:
        return self.path(name).read_bytes()

    def exists(self, name: str) -> bool:
        return self.path(name).is_file()

    def delete(self, name: str) -> None:
        self.path(name).unlink(missing_ok=True)

    def size(self, name: str) -> int:
        return self.path(name).stat().st_size

    def list(self) -> Iterable[StoredFile]:
        for f in self.dir.iterdir():
            if not f.is_file():
                continue
            st = f.stat()
            yield StoredFile(
                f.name, st.st_size, datetime.fromtimestamp(st.st_mtime, tz=timezone.utc)
            )


class S3Storage:
    """S3-совместимое хранилище (MinIO локально, S3/Spaces в проде).

    Отдаём файлы через собственный роут `/media/<имя>`, а не прямыми ссылками
    на бакет: один домен для фронта, никаких CORS и подписанных URL."""

    kind = "s3"

    def __init__(self) -> None:
        import boto3  # локальный импорт: нужен только при MEDIA_BACKEND=s3
        from botocore.client import Config

        self.bucket = settings.s3_bucket
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint or None,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            region_name=settings.s3_region,
            config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
        )
        self._ensure_bucket()

    def _ensure_bucket(self) -> None:
        from botocore.exceptions import ClientError

        try:
            self.client.head_bucket(Bucket=self.bucket)
        except ClientError:
            try:
                self.client.create_bucket(Bucket=self.bucket)
                log.info("Создан бакет %s", self.bucket)
            except ClientError as exc:  # гонка при параллельном старте — не фатально
                log.warning("Не удалось создать бакет %s: %s", self.bucket, exc)

    def save(self, name: str, data: bytes) -> None:
        self.client.put_object(Bucket=self.bucket, Key=name, Body=data)

    def save_file(self, name: str, src: Path) -> None:
        self.client.upload_file(str(src), self.bucket, name)

    def open(self, name: str) -> BinaryIO:
        return self.client.get_object(Bucket=self.bucket, Key=name)["Body"]

    def read(self, name: str) -> bytes:
        return self.client.get_object(Bucket=self.bucket, Key=name)["Body"].read()

    def exists(self, name: str) -> bool:
        from botocore.exceptions import ClientError

        try:
            self.client.head_object(Bucket=self.bucket, Key=name)
            return True
        except ClientError:
            return False

    def delete(self, name: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=name)

    def size(self, name: str) -> int:
        return int(self.client.head_object(Bucket=self.bucket, Key=name)["ContentLength"])

    def list(self) -> Iterable[StoredFile]:
        paginator = self.client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self.bucket):
            for obj in page.get("Contents", []):
                yield StoredFile(obj["Key"], obj["Size"], obj["LastModified"])


_storage = None


def get_storage():
    """Singleton выбранного бэкенда. При падении S3 — деградируем в локальный,
    чтобы админка осталась работоспособной (файлы просто лягут на диск)."""
    global _storage
    if _storage is None:
        if settings.media_backend == "s3":
            try:
                _storage = S3Storage()
                log.info("Медиа: S3/MinIO, бакет %s", settings.s3_bucket)
            except Exception as exc:
                log.error("S3 недоступен (%s) — переключаюсь на локальный диск", exc)
                _storage = LocalStorage(settings.media_dir)
        else:
            _storage = LocalStorage(settings.media_dir)
    return _storage
