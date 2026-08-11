"""Публичные эндпоинты (без авторизации): каталог, баннер, контакты, фичи, политика."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import AppSettings, Banner, Contacts, Document, Floorplan, PlanCategory
from ..schemas import BannerOut, ContactsOut, DocumentOut, FeaturesOut, FloorplanOut

router = APIRouter(prefix="/api/v1", tags=["public"])


@router.get("/features", response_model=FeaturesOut)
def get_features():
    """Какие блоки включены (фичефлаги из .env) — фронт скрывает выключенные."""
    return FeaturesOut(
        news=settings.feature_news,
        faq=settings.feature_faq,
        advantages=settings.feature_advantages,
        partners=settings.feature_partners,
        team=settings.feature_team,
        documents=settings.feature_documents,
        calculator=settings.feature_calculator,
        seo_admin=settings.feature_seo_admin,
    )


@router.get("/analytics")
def get_analytics(db: Session = Depends(get_db)):
    """Публичные параметры аналитики и верификации. Метрика инициализируется
    на клиенте ТОЛЬКО после согласия в cookie-баннере (152-ФЗ)."""
    s = db.get(AppSettings, 1)
    return {
        "metrika_id": s.metrika_id if s else None,
        "yandex_verification": s.yandex_verification if s else None,
        "google_verification": s.google_verification if s else None,
    }


@router.get("/policy-document", response_model=DocumentOut)
def get_policy_document(db: Session = Depends(get_db)):
    """Активный документ с пометкой Политики конфиденциальности — на него
    ссылается чекбокс согласия у форм (152-ФЗ)."""
    doc = db.scalar(
        select(Document).where(Document.is_policy.is_(True), Document.active.is_(True)).order_by(Document.sort)
    )
    if doc is None:
        raise HTTPException(404, "not_found")
    return doc


def _prices_hidden(db: Session) -> bool:
    """З6: глобальный фичефлаг. show_prices=false → скрываем цену для всех."""
    s = db.get(AppSettings, 1)
    return bool(s) and not s.show_prices


def _serialize_fp(fp: Floorplan, hide_price: bool) -> FloorplanOut:
    out = FloorplanOut.model_validate(fp)
    if hide_price:
        out.price = None
    return out


@router.get("/floorplans", response_model=list[FloorplanOut])
def list_floorplans(category: str | None = Query(default=None), db: Session = Depends(get_db)):
    """Каталог планировок; ?category={slug} — ЧПУ-фильтр по категории.
    Неизвестный слаг категории → 404 (фронт по этому резолвит один сегмент)."""
    q = select(Floorplan).where(Floorplan.active.is_(True)).order_by(Floorplan.sort)
    if category is not None:
        cat = db.scalar(
            select(PlanCategory).where(PlanCategory.slug == category, PlanCategory.active.is_(True))
        )
        if cat is None:
            raise HTTPException(status_code=404, detail="category_not_found")
        q = q.where(Floorplan.category_id == cat.id)
    hide = _prices_hidden(db)
    return [_serialize_fp(fp, hide) for fp in db.scalars(q).all()]


@router.get("/floorplans/{slug}", response_model=FloorplanOut)
def get_floorplan(slug: str, db: Session = Depends(get_db)):
    fp = db.scalar(select(Floorplan).where(Floorplan.slug == slug, Floorplan.active.is_(True)))
    if fp is None:
        raise HTTPException(status_code=404, detail="not_found")
    return _serialize_fp(fp, _prices_hidden(db))


@router.get("/banner", response_model=BannerOut)
def get_banner(db: Session = Depends(get_db)):
    b = db.get(Banner, 1)
    if b is None:
        raise HTTPException(status_code=404, detail="not_found")
    return b


@router.get("/contacts", response_model=ContactsOut)
def get_contacts(db: Session = Depends(get_db)):
    c = db.get(Contacts, 1)
    if c is None:
        raise HTTPException(status_code=404, detail="not_found")
    return c
