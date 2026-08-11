"""301-редиректы: публичный резолв для сайта + админ-CRUD (по образцу seo.py)."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Redirect
from ..redirects import apply_redirect_invariants
from ..schemas import (
    RedirectCreate, RedirectOut, RedirectResolveOut, RedirectUpdate,
    _normalize_redirect_path,
)
from ..security import require_role

router = APIRouter(prefix="/api/v1", tags=["redirects"])
admin_only = require_role("admin")


@router.get("/redirects/resolve", response_model=RedirectResolveOut)
def resolve_redirect(path: str = Query(...), db: Session = Depends(get_db)):
    """Куда ведёт старый путь. Фронт спрашивает только перед notFound() —
    живая страница на этом пути всегда выигрывает у редиректа."""
    try:
        norm = _normalize_redirect_path(path)
    except ValueError:
        raise HTTPException(status_code=404, detail="not_found")
    r = db.scalar(select(Redirect).where(Redirect.from_path == norm, Redirect.active.is_(True)))
    if r is None:
        raise HTTPException(status_code=404, detail="not_found")
    return r


@router.get("/admin/redirects", response_model=list[RedirectOut])
def admin_list_redirects(db: Session = Depends(get_db), _=Depends(admin_only)):
    return list(db.scalars(select(Redirect).order_by(Redirect.from_path)).all())


@router.get("/admin/redirects/{item_id}", response_model=RedirectOut)
def admin_get_redirect(item_id: uuid.UUID, db: Session = Depends(get_db), _=Depends(admin_only)):
    r = db.get(Redirect, item_id)
    if r is None:
        raise HTTPException(status_code=404, detail="not_found")
    return r


@router.post("/admin/redirects", response_model=RedirectOut, status_code=201)
def admin_create_redirect(payload: RedirectCreate, db: Session = Depends(get_db), _=Depends(admin_only)):
    if db.scalar(select(Redirect).where(Redirect.from_path == payload.from_path)):
        raise HTTPException(status_code=409, detail="path_exists")
    # Инварианты трогают чужие записи только для БОЕВОГО редиректа:
    # неактивный черновик не должен переписывать работающие редиректы
    if payload.active:
        apply_redirect_invariants(db, payload.from_path, payload.to_path)
    r = Redirect(**payload.model_dump())
    db.add(r)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="path_exists")
    db.refresh(r)
    return r


@router.put("/admin/redirects/{item_id}", response_model=RedirectOut)
def admin_update_redirect(
    item_id: uuid.UUID, payload: RedirectUpdate, db: Session = Depends(get_db), _=Depends(admin_only)
):
    r = db.get(Redirect, item_id)
    if r is None:
        raise HTTPException(status_code=404, detail="not_found")
    data = payload.model_dump(exclude_unset=True)
    from_path = data.get("from_path", r.from_path)
    to_path = data.get("to_path", r.to_path)
    if from_path == to_path:
        raise HTTPException(status_code=422, detail="redirect_to_self")
    if from_path != r.from_path and db.scalar(select(Redirect).where(Redirect.from_path == from_path)):
        raise HTTPException(status_code=409, detail="path_exists")
    for k, v in data.items():
        setattr(r, k, v)
    # exclude_id: при autoflush=False SELECT видит старые значения записи —
    # без исключения разворот /a→/b в /b→/a удалил бы саму запись
    if r.active:
        apply_redirect_invariants(db, r.from_path, r.to_path, exclude_id=r.id)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="path_exists")
    db.refresh(r)
    return r


@router.delete("/admin/redirects/{item_id}", status_code=204)
def admin_delete_redirect(item_id: uuid.UUID, db: Session = Depends(get_db), _=Depends(admin_only)):
    r = db.get(Redirect, item_id)
    if r is None:
        raise HTTPException(status_code=404, detail="not_found")
    db.delete(r)
    db.commit()
