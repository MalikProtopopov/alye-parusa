"""Слаги: RU-транслитерация, уникализация и бэкфилл (документы)."""
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

_RU_MAP = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e",
    "ж": "zh", "з": "z", "и": "i", "й": "j", "к": "k", "л": "l", "м": "m",
    "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
    "ф": "f", "х": "h", "ц": "c", "ч": "ch", "ш": "sh", "щ": "sch",
    "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
}


def slugify(title: str) -> str:
    """«Проектная декларация» → "proektnaya-deklaraciya". Пустой вход → "doc"."""
    text = (title or "").lower()
    text = "".join(_RU_MAP.get(ch, ch) for ch in text)
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text or "doc"


def unique_slug(db: Session, model, base: str, slug_field: str = "slug") -> str:
    """Добавляет суффиксы -2, -3… при коллизии слага в таблице model."""
    col = getattr(model, slug_field)
    candidate, n = base, 1
    while db.scalar(select(model).where(col == candidate)) is not None:
        n += 1
        candidate = f"{base}-{n}"
    return candidate


def backfill_document_slugs(db: Session) -> None:
    """Генерирует слаги для документов без slug (перенос со старой схемы)."""
    from .models import Document

    rows = db.scalars(select(Document).where(Document.slug.is_(None))).all()
    for doc in rows:
        doc.slug = unique_slug(db, Document, slugify(doc.title))
        db.flush()
    if rows:
        db.commit()
