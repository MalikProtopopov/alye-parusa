"""Авто-301 при смене слагов. Держит таблицу redirect без петель и цепочек:
любой редирект всегда ведёт в конечную живую страницу за один хоп."""
import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Redirect

log = logging.getLogger("app.redirects")


def apply_redirect_invariants(
    db: Session, from_path: str, to_path: str, exclude_id=None
) -> None:
    """Правила против петель/цепочек (без commit — транзакция вызывающего):
    1) целевой путь перестаёт быть редиректом (страница снова живая);
    2) всё, что вело в from_path, переводится сразу в to_path (flatten).
    exclude_id — id редактируемой записи: при autoflush=False SELECT видит её
    СТАРЫЕ значения в БД, и без исключения запись можно удалить саму по себе
    (напр. разворот /a→/b в /b→/a)."""
    inverse_q = select(Redirect).where(Redirect.from_path == to_path)
    if exclude_id is not None:
        inverse_q = inverse_q.where(Redirect.id != exclude_id)
    inverse = db.scalar(inverse_q)
    if inverse is not None:
        db.delete(inverse)
    chained_q = select(Redirect).where(Redirect.to_path == from_path)
    if exclude_id is not None:
        chained_q = chained_q.where(Redirect.id != exclude_id)
    for chained in db.scalars(chained_q).all():
        if chained.from_path == to_path:
            db.delete(chained)  # стал бы петлёй после flatten
        else:
            chained.to_path = to_path


def record_slug_redirect(db: Session, prefix: str, old_slug: str, new_slug: str) -> None:
    """Вызывается при смене слага сущности (в транзакции update).
    Живая страница на from_path всегда выигрывает: фронт спрашивает resolve
    только перед notFound()."""
    if not old_slug or not new_slug or old_slug == new_slug:
        return
    from_path = f"{prefix}/{old_slug}"
    to_path = f"{prefix}/{new_slug}"
    apply_redirect_invariants(db, from_path, to_path)
    existing = db.scalar(select(Redirect).where(Redirect.from_path == from_path))
    if existing is not None:
        existing.to_path = to_path
        existing.active = True
        existing.note = "авто: смена слага"
    else:
        db.add(Redirect(from_path=from_path, to_path=to_path, note="авто: смена слага"))
    log.info("Авто-редирект: %s -> %s", from_path, to_path)
