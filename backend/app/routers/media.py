"""Медиа-пайплайн (AD2, раздел 06 ТЗ): загрузка из админки с автообработкой.

Правила:
- Оригинал ВСЕГДА сохраняется (`{id}_orig.*`).
- Рядом генерируются веб-версии: для изображений — даунскейл до 1600px + WebP
  (`{id}.webp`) и превью 480px (`{id}_thumb.webp`); для видео — транскод H.264
  до 1280px (`{id}.mp4`, faststart) и постер (`{id}_thumb.jpg`).
- В поле контента (и дальше в клиентские API) подставляется ОПТИМИЗИРОВАННЫЙ url;
  оригинал доступен по original_url.
- GIF и PDF хранятся как есть (анимации/документы не пережимаем в демо).
Валидация — по фактическому содержимому (Pillow / magic-байты), не по имени файла.
"""
import io
import shutil
import subprocess
import uuid
from datetime import datetime, timezone
import tempfile
from contextlib import contextmanager
from pathlib import Path, PurePosixPath

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from PIL import Image, UnidentifiedImageError

from ..config import settings
from ..db import get_db
from ..security import require_role
from ..storage import get_storage, public_url

router = APIRouter(prefix="/api/v1/admin", tags=["media"])
admin_only = require_role("admin")

IMAGE_FORMATS = {
    "JPEG": (".jpg", "image/jpeg"),
    "PNG": (".png", "image/png"),
    "WEBP": (".webp", "image/webp"),
}
PDF_MAGIC = b"%PDF-"
WEBM_MAGIC = b"\x1aE\xdf\xa3"  # EBML (webm/mkv)

OPT_MAX_W = 1600    # ширина веб-версии изображения
THUMB_MAX_W = 480   # ширина превью
WEBP_Q = 82
THUMB_Q = 70
VIDEO_MAX_W = 1280

EXT_MIME = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
    ".webp": "image/webp", ".gif": "image/gif", ".pdf": "application/pdf",
    ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
}


def media_dir() -> Path:
    d = Path(settings.media_dir)
    d.mkdir(parents=True, exist_ok=True)
    return d


@contextmanager
def _working_dir():
    """Каталог, где PIL/ffmpeg собирают файлы.
    local — сразу боевой каталог (без лишних копирований);
    s3 — временный, после сборки файлы уезжают в бакет."""
    storage = get_storage()
    if storage.kind == "local":
        yield Path(storage.dir), False
    else:
        with tempfile.TemporaryDirectory(prefix="media-") as tmp:
            yield Path(tmp), True


def _push(work: Path, names: list[str | None]) -> None:
    """Выложить собранные файлы в хранилище (для s3-бэкенда)."""
    storage = get_storage()
    for name in names:
        if name and (work / name).is_file():
            storage.save_file(name, work / name)


def _is_video(data: bytes) -> str | None:
    """Определяет видео по magic-байтам → расширение оригинала или None."""
    if len(data) > 12 and data[4:8] == b"ftyp":
        return ".mp4"  # mp4/mov семейство (ISO BMFF)
    if data[:4] == WEBM_MAGIC:
        return ".webm"
    return None


def _save_image(data: bytes, base: str, d: Path) -> dict:
    img = Image.open(io.BytesIO(data))
    fmt = (img.format or "").upper()

    if fmt == "GIF":  # анимации не пережимаем — как есть
        name = f"{base}.gif"
        (d / name).write_bytes(data)
        return {"main": name, "orig": None, "thumb": None,
                "content_type": "image/gif", "width": img.width, "height": img.height}

    if fmt not in IMAGE_FORMATS:
        raise HTTPException(415, f"unsupported_image_format_{fmt or 'unknown'}")
    orig_ext, _ = IMAGE_FORMATS[fmt]

    orig_name = f"{base}_orig{orig_ext}"
    (d / orig_name).write_bytes(data)

    # RGBA/палитра → RGB не обязателен для WebP (умеет альфу); нормализуем режимы
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGBA" if "A" in img.mode or "transparency" in img.info else "RGB")

    def scaled(maxw: int) -> Image.Image:
        if img.width <= maxw:
            return img.copy()  # никогда не апскейлим
        h = round(img.height * maxw / img.width)
        return img.resize((maxw, h), Image.LANCZOS)

    main = scaled(OPT_MAX_W)
    main_name = f"{base}.webp"
    main.save(d / main_name, "WEBP", quality=WEBP_Q, method=4)

    thumb = scaled(THUMB_MAX_W)
    thumb_name = f"{base}_thumb.webp"
    thumb.save(d / thumb_name, "WEBP", quality=THUMB_Q, method=4)

    return {"main": main_name, "orig": orig_name, "thumb": thumb_name,
            "content_type": "image/webp", "width": main.width, "height": main.height}


def _save_video(data: bytes, ext: str, base: str, d: Path) -> dict:
    orig_name = f"{base}_orig{ext}"
    orig_path = d / orig_name
    orig_path.write_bytes(data)

    if shutil.which("ffmpeg") is None:
        # деградация без ffmpeg: отдаём оригинал как основной файл
        return {"main": orig_name, "orig": None, "thumb": None,
                "content_type": EXT_MIME.get(ext, "video/mp4"), "width": None, "height": None}

    main_name = f"{base}.mp4"
    thumb_name = f"{base}_thumb.jpg"
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(orig_path),
             "-vf", f"scale='min({VIDEO_MAX_W},iw)':-2",
             "-c:v", "libx264", "-preset", "veryfast", "-crf", "28",
             "-movflags", "+faststart", "-c:a", "aac", "-b:a", "128k",
             str(d / main_name)],
            check=True, capture_output=True, timeout=300,
        )
        subprocess.run(
            ["ffmpeg", "-y", "-ss", "0.5", "-i", str(d / main_name),
             "-frames:v", "1", "-vf", f"scale='min({THUMB_MAX_W},iw)':-2",
             str(d / thumb_name)],
            check=True, capture_output=True, timeout=60,
        )
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        # битое/неподдерживаемое видео — чистим и отклоняем
        for f in (d / main_name, d / thumb_name, orig_path):
            f.unlink(missing_ok=True)
        raise HTTPException(415, "video_processing_failed")

    return {"main": main_name, "orig": orig_name,
            "thumb": thumb_name if (d / thumb_name).exists() else None,
            "content_type": "video/mp4", "width": None, "height": None}


@router.post("/media", status_code=201)
async def upload_media(request: Request, file: UploadFile = File(...), _=Depends(admin_only)):
    data = await file.read()
    if len(data) == 0:
        raise HTTPException(422, "empty_file")

    base = uuid.uuid4().hex
    video_ext = _is_video(data)

    with _working_dir() as (d, needs_push):
        if video_ext:
            max_bytes = settings.media_max_video_mb * 1024 * 1024
            if len(data) > max_bytes:
                raise HTTPException(413, f"file_too_large_max_{settings.media_max_video_mb}mb")
            info = _save_video(data, video_ext, base, d)
            kind = "video"
        elif data[:5] == PDF_MAGIC:
            max_bytes = settings.media_max_mb * 1024 * 1024
            if len(data) > max_bytes:
                raise HTTPException(413, f"file_too_large_max_{settings.media_max_mb}mb")
            name = f"{base}.pdf"
            (d / name).write_bytes(data)
            info = {"main": name, "orig": None, "thumb": None,
                    "content_type": "application/pdf", "width": None, "height": None}
            kind = "pdf"
        else:
            max_bytes = settings.media_max_mb * 1024 * 1024
            if len(data) > max_bytes:
                raise HTTPException(413, f"file_too_large_max_{settings.media_max_mb}mb")
            try:
                Image.open(io.BytesIO(data)).verify()
                info = _save_image(data, base, d)
            except HTTPException:
                raise
            except (UnidentifiedImageError, OSError):
                raise HTTPException(415, "unsupported_media_type (jpeg/png/webp/gif/pdf/mp4/webm)")
            kind = "gif" if info["content_type"] == "image/gif" else "image"

        main_size = (d / info["main"]).stat().st_size
        if needs_push:
            _push(d, [info["main"], info["orig"], info["thumb"]])

    # Ссылки ОТНОСИТЕЛЬНЫЕ: домен подставляет фронт (админка — свой API-хост,
    # сайт — свой rewrite). В БД попадает путь, не зависящий от окружения.
    return {
        "url": public_url(info["main"]),
        "path": public_url(info["main"]),
        "original_url": public_url(info["orig"]) if info["orig"] else None,
        "thumb_url": public_url(info["thumb"]) if info["thumb"] else None,
        "kind": kind,
        "filename": file.filename,
        "content_type": info["content_type"],
        "size": main_size,
        "original_size": len(data),
        "width": info["width"],
        "height": info["height"],
    }


# Публичная отдача файлов: один URL-нейм-спейс независимо от бэкенда
# хранилища (диск или MinIO/S3) — фронтам не нужны ни CORS, ни подписанные
# ссылки. Имена контент-хэшированы, поэтому кэш годовой.
public_router = APIRouter(tags=["media"])


@public_router.get("/media/{name}")
def serve_media(name: str):
    if "/" in name or "\\" in name or ".." in name:
        raise HTTPException(422, "bad_name")
    p = PurePosixPath(name)
    mime = EXT_MIME.get(p.suffix.lower())
    storage = get_storage()
    if mime is None or not storage.exists(name):
        raise HTTPException(404, "not_found")
    headers = {"Cache-Control": "public, max-age=31536000, immutable"}
    if storage.kind == "local":
        return FileResponse(storage.path(name), media_type=mime, headers=headers)
    return StreamingResponse(storage.open(name), media_type=mime, headers=headers)


@router.get("/media")
def list_media(_=Depends(admin_only)):
    """Медиатека: только основные (оптимизированные) файлы; варианты — ссылками."""
    files = sorted(get_storage().list(), key=lambda f: f.modified, reverse=True)
    by_stem: dict[str, str] = {}
    for f in files:
        stem = PurePosixPath(f.name).stem
        if stem.endswith("_orig") or stem.endswith("_thumb"):
            by_stem[stem] = f.name

    items = []
    for f in files:
        p = PurePosixPath(f.name)
        stem = p.stem
        if stem.endswith("_orig") or stem.endswith("_thumb"):
            continue  # варианты не показываем отдельными строками
        mime = EXT_MIME.get(p.suffix.lower())
        if mime is None:
            continue
        orig = by_stem.get(f"{stem}_orig")
        thumb = by_stem.get(f"{stem}_thumb")
        items.append({
            "name": f.name,
            "url": public_url(f.name),
            "path": public_url(f.name),
            "original_url": public_url(orig) if orig else None,
            "thumb_url": public_url(thumb) if thumb else None,
            "content_type": mime,
            "size": f.size,
            "uploaded_at": f.modified.isoformat(),
        })
        if len(items) >= 500:
            break
    return {"items": items}


def _media_usages(db, name: str) -> list[dict]:
    """Где используется файл /media/{name} или его варианты (_orig/_thumb) —
    защита от битых картинок на сайте. Ищем по stem: имена — контент-хэши,
    ложных срабатываний не бывает."""
    from pathlib import PurePosixPath

    from sqlalchemy import select

    from ..models import (
        Advantage, Banner, Document, Floorplan, News, Partner, SeoMeta, TeamMember,
    )

    needle = f"%/media/{PurePosixPath(name).stem}%"
    used: list[dict] = []
    checks = [
        (Floorplan, Floorplan.image_url, "floorplan", lambda o: o.title),
        (News, News.cover_image_url, "news", lambda o: o.title),
        (Advantage, Advantage.image_url, "advantage", lambda o: o.title),
        (Partner, Partner.logo_url, "partner", lambda o: o.name),
        (TeamMember, TeamMember.photo_url, "team", lambda o: o.name),
        (Document, Document.file_url, "document", lambda o: o.title),
        (SeoMeta, SeoMeta.og_image_url, "seo", lambda o: o.slug),
        (Banner, Banner.background_url, "banner", lambda o: "Hero / Баннер"),
    ]
    for model, col, kind, title_of in checks:
        for obj in db.scalars(select(model).where(col.like(needle))).all():
            used.append({"type": kind, "id": str(obj.id), "title": title_of(obj)})
    return used


@router.delete("/media/{name}", status_code=204)
def delete_media(name: str, db=Depends(get_db), _=Depends(admin_only)):
    """Удаляет основной файл и все его варианты (оригинал, превью).
    Файл, на который ссылается контент, удалить нельзя (иначе битые картинки)."""
    if "/" in name or "\\" in name or ".." in name:
        raise HTTPException(422, "bad_name")
    storage = get_storage()
    p = PurePosixPath(name)
    if p.suffix.lower() not in EXT_MIME or not storage.exists(name):
        raise HTTPException(404, "not_found")
    used = _media_usages(db, name)
    if used:
        raise HTTPException(409, {"code": "media_in_use", "used_by": used})
    stem = p.stem
    storage.delete(name)
    for f in list(storage.list()):
        f_stem = PurePosixPath(f.name).stem
        if f_stem in (f"{stem}_orig", f"{stem}_thumb"):
            storage.delete(f.name)
