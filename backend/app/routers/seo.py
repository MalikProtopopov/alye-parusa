"""SEO-теги по слагу (SEO2), управляются из админки; публично отдаются по слагу.
Плюс: список известных путей сайта (для page-picker и «страниц без SEO»)
и публичный список noindex-путей (исключаются из sitemap)."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Document, Floorplan, News, PlanCategory, SeoMeta
from ..schemas import SeoMetaCreate, SeoMetaOut, SeoMetaUpdate
from ..security import require_role

router = APIRouter(prefix="/api/v1", tags=["seo"])
admin_only = require_role("admin")

_STATIC_PATHS = [
    ("/", "Главная"),
    ("/planirovki", "Каталог планировок"),
    ("/novosti", "Новости"),
    ("/dokumenty", "Документы"),
]


@router.get("/seo", response_model=SeoMetaOut)
def get_seo(slug: str = Query(...), db: Session = Depends(get_db)):
    obj = db.scalar(select(SeoMeta).where(SeoMeta.slug == slug))
    if obj is None:
        raise HTTPException(404, "not_found")
    return obj


@router.get("/seo/noindex", response_model=list[str])
def list_noindex(db: Session = Depends(get_db)):
    """Пути с noindex=true — сайт исключает их из sitemap."""
    return list(db.scalars(select(SeoMeta.slug).where(SeoMeta.noindex.is_(True))).all())


@router.get("/admin/seo-known-paths")
def admin_known_paths(db: Session = Depends(get_db), _=Depends(admin_only)):
    """Все реальные пути сайта + признак наличия SEO-записи.
    Питает page-picker и панель «Страницы без SEO» в админке."""
    seo_slugs = set(db.scalars(select(SeoMeta.slug)).all())
    out = [
        {"path": p, "label": label, "kind": "static", "has_seo": p in seo_slugs}
        for p, label in _STATIC_PATHS
    ]
    for cat in db.scalars(select(PlanCategory).where(PlanCategory.active.is_(True)).order_by(PlanCategory.sort)).all():
        p = f"/planirovki/{cat.slug}"
        out.append({"path": p, "label": f"Категория: {cat.title}", "kind": "plan_category", "has_seo": p in seo_slugs})
    for fp in db.scalars(select(Floorplan).where(Floorplan.active.is_(True)).order_by(Floorplan.sort)).all():
        p = f"/planirovki/{fp.slug}"
        out.append({"path": p, "label": f"Планировка: {fp.title}", "kind": "floorplan", "has_seo": p in seo_slugs})
    for n in db.scalars(select(News).where(News.active.is_(True)).order_by(News.sort)).all():
        p = f"/novosti/{n.slug}"
        out.append({"path": p, "label": f"Новость: {n.title}", "kind": "news", "has_seo": p in seo_slugs})
    for d in db.scalars(select(Document).where(Document.active.is_(True)).order_by(Document.sort)).all():
        p = f"/dokumenty/{d.slug}"
        out.append({"path": p, "label": f"Документ: {d.title}", "kind": "document", "has_seo": p in seo_slugs})
    return out


@router.get("/admin/seo", response_model=list[SeoMetaOut])
def admin_list_seo(db: Session = Depends(get_db), _=Depends(admin_only)):
    return list(db.scalars(select(SeoMeta).order_by(SeoMeta.slug)).all())


@router.get("/admin/seo/{item_id}", response_model=SeoMetaOut)
def admin_get_seo(item_id: uuid.UUID, db: Session = Depends(get_db), _=Depends(admin_only)):
    obj = db.get(SeoMeta, item_id)
    if obj is None:
        raise HTTPException(404, "not_found")
    return obj


@router.post("/admin/seo", response_model=SeoMetaOut, status_code=201)
def admin_create_seo(payload: SeoMetaCreate, db: Session = Depends(get_db), _=Depends(admin_only)):
    if db.scalar(select(SeoMeta).where(SeoMeta.slug == payload.slug)):
        raise HTTPException(409, "slug_exists")
    obj = SeoMeta(**payload.model_dump())
    db.add(obj)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "slug_exists")
    db.refresh(obj)
    return obj


@router.put("/admin/seo/{item_id}", response_model=SeoMetaOut)
def admin_update_seo(item_id: uuid.UUID, payload: SeoMetaUpdate, db: Session = Depends(get_db), _=Depends(admin_only)):
    obj = db.get(SeoMeta, item_id)
    if obj is None:
        raise HTTPException(404, "not_found")
    data = payload.model_dump(exclude_unset=True)
    if data.get("slug") and data["slug"] != obj.slug and db.scalar(select(SeoMeta).where(SeoMeta.slug == data["slug"])):
        raise HTTPException(409, "slug_exists")
    for k, v in data.items():
        setattr(obj, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "slug_exists")
    db.refresh(obj)
    return obj


@router.delete("/admin/seo/{item_id}", status_code=204)
def admin_delete_seo(item_id: uuid.UUID, db: Session = Depends(get_db), _=Depends(admin_only)):
    obj = db.get(SeoMeta, item_id)
    if obj is None:
        raise HTTPException(404, "not_found")
    db.delete(obj)
    db.commit()
