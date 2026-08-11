"""Генерик-фабрика роутеров контентных блоков (CMS).
Для каждой сущности: публичный GET-список (+ по слагу, если есть) и админ-CRUD.
Опциональные хуки: before_write/before_delete (guard-инварианты, напр. Политика),
annotate (вычисляемые поля в админ-ответах), public_prefix (авто-301 при смене слага)."""
import uuid
from typing import Callable, Type

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import (
    Advantage, Document, Fact, Faq, Floorplan, HeroChapter, News, Partner,
    PlanCategory, SiteText, TeamMember,
)
from ..redirects import record_slug_redirect
from ..schemas import (
    AdvantageCreate, AdvantageOut, AdvantageUpdate, DocumentCreate, DocumentOut,
    DocumentUpdate, FactCreate, FactOut, FactUpdate, FaqCreate, FaqOut,
    FaqUpdate, HeroChapterCreate, HeroChapterOut, HeroChapterUpdate, NewsCreate,
    NewsOut, NewsUpdate, PartnerCreate, PartnerOut, PartnerUpdate,
    PlanCategoryCreate, PlanCategoryOut, PlanCategoryUpdate, ReorderItem,
    SiteTextCreate, SiteTextOut, SiteTextUpdate, TeamMemberCreate,
    TeamMemberOut, TeamMemberUpdate,
)
from ..security import require_role

admin_only = require_role("admin")


def make_content_router(
    *, path: str, model: Type, out_schema, create_schema, update_schema,
    slug_field: str | None = None,
    public_prefix: str | None = None,
    before_write: Callable[[Session, dict, object | None], None] | None = None,
    before_delete: Callable[[Session, object], None] | None = None,
    annotate: Callable[[Session, list], None] | None = None,
) -> APIRouter:
    router = APIRouter(prefix="/api/v1", tags=[path])

    # ── Публичные ──
    @router.get(f"/{path}", response_model=list[out_schema])
    def _list(db: Session = Depends(get_db)):
        q = select(model).where(model.active.is_(True)).order_by(model.sort)
        return list(db.scalars(q).all())

    if slug_field:
        @router.get(f"/{path}/{{key}}", response_model=out_schema)
        def _get_by_slug(key: str, db: Session = Depends(get_db)):
            obj = db.scalar(
                select(model).where(getattr(model, slug_field) == key, model.active.is_(True))
            )
            if obj is None:
                raise HTTPException(404, "not_found")
            return obj

    # ── Админ CRUD ──
    @router.get(f"/admin/{path}", response_model=list[out_schema])
    def _admin_list(db: Session = Depends(get_db), _=Depends(admin_only)):
        objs = list(db.scalars(select(model).order_by(model.sort)).all())
        if annotate:
            annotate(db, objs)
        return objs

    @router.post(f"/admin/{path}/reorder", status_code=204)
    def _admin_reorder(items: list[ReorderItem], db: Session = Depends(get_db), _=Depends(admin_only)):
        """Массовая смена порядка (drag-n-drop в админке)."""
        by_id = {i.id: i.sort for i in items}
        for obj in db.scalars(select(model).where(model.id.in_(by_id))).all():
            obj.sort = by_id[obj.id]
        db.commit()

    @router.get(f"/admin/{path}/{{item_id}}", response_model=out_schema)
    def _admin_get(item_id: uuid.UUID, db: Session = Depends(get_db), _=Depends(admin_only)):
        obj = db.get(model, item_id)
        if obj is None:
            raise HTTPException(404, "not_found")
        if annotate:
            annotate(db, [obj])
        return obj

    @router.post(f"/admin/{path}", response_model=out_schema, status_code=201)
    def _admin_create(payload: create_schema, db: Session = Depends(get_db), _=Depends(admin_only)):
        data = payload.model_dump()
        if slug_field and db.scalar(select(model).where(getattr(model, slug_field) == data.get(slug_field))):
            raise HTTPException(409, "slug_exists")
        if before_write:
            before_write(db, data, None)
        obj = model(**data)
        db.add(obj)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, "conflict")
        db.refresh(obj)
        if annotate:
            annotate(db, [obj])
        return obj

    @router.put(f"/admin/{path}/{{item_id}}", response_model=out_schema)
    def _admin_update(item_id: uuid.UUID, payload: update_schema, db: Session = Depends(get_db), _=Depends(admin_only)):
        obj = db.get(model, item_id)
        if obj is None:
            raise HTTPException(404, "not_found")
        data = payload.model_dump(exclude_unset=True)
        old_slug = getattr(obj, slug_field) if slug_field else None
        if slug_field and data.get(slug_field) and data[slug_field] != old_slug:
            if db.scalar(select(model).where(getattr(model, slug_field) == data[slug_field])):
                raise HTTPException(409, "slug_exists")
        if before_write:
            before_write(db, data, obj)
        for k, v in data.items():
            setattr(obj, k, v)
        # Авто-301: публичный слаг сменился → старый URL ведёт на новый
        if (
            public_prefix and slug_field == "slug"
            and data.get("slug") and data["slug"] != old_slug
        ):
            record_slug_redirect(db, public_prefix, old_slug, data["slug"])
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, "conflict")
        db.refresh(obj)
        if annotate:
            annotate(db, [obj])
        return obj

    @router.delete(f"/admin/{path}/{{item_id}}", status_code=204)
    def _admin_delete(item_id: uuid.UUID, db: Session = Depends(get_db), _=Depends(admin_only)):
        obj = db.get(model, item_id)
        if obj is None:
            raise HTTPException(404, "not_found")
        if before_delete:
            before_delete(db, obj)
        db.delete(obj)
        db.commit()

    return router


# ── Хуки-инварианты ──


def _policy_before_write(db: Session, data: dict, current: object | None) -> None:
    """152-ФЗ: ровно один активный документ-Политика.
    Установка is_policy снимает пометку с других; нельзя молча остаться без Политики."""
    if data.get("is_policy") is True:
        # Пометить Политикой можно только документ, который ОСТАНЕТСЯ активным:
        # иначе пометка снимется с рабочей Политики и сайт останется без неё
        effective_active = data.get(
            "active", current.active if current is not None else True
        )
        if effective_active is False:
            raise HTTPException(409, "policy_required")
        others = db.scalars(
            select(Document).where(Document.is_policy.is_(True))
        ).all()
        for doc in others:
            if current is None or doc.id != current.id:
                doc.is_policy = False
        return
    if current is None or not current.is_policy or not current.active:
        return
    # Правим единственную активную Политику: снятие пометки или деактивация запрещены
    unchecking = data.get("is_policy") is False
    deactivating = data.get("active") is False
    if not (unchecking or deactivating):
        return
    another = db.scalar(
        select(Document).where(
            Document.is_policy.is_(True), Document.active.is_(True), Document.id != current.id
        )
    )
    if another is None:
        raise HTTPException(409, "policy_required")


def _policy_before_delete(db: Session, obj: Document) -> None:
    if not (obj.is_policy and obj.active):
        return
    another = db.scalar(
        select(Document).where(
            Document.is_policy.is_(True), Document.active.is_(True), Document.id != obj.id
        )
    )
    if another is None:
        raise HTTPException(409, "policy_required")


def _annotate_floorplans_count(db: Session, categories: list) -> None:
    """Кол-во планировок в категории — для предупреждений в админке."""
    ids = [c.id for c in categories]
    if not ids:
        return
    counts = dict(
        db.execute(
            select(Floorplan.category_id, func.count())
            .where(Floorplan.category_id.in_(ids))
            .group_by(Floorplan.category_id)
        ).all()
    )
    for c in categories:
        c.floorplans_count = counts.get(c.id, 0)


# Инстансы роутеров (ключ = имя фичефлага в config, значение = роутер)
CONTENT_ROUTERS: dict[str, APIRouter] = {
    "news": make_content_router(
        path="news", model=News, out_schema=NewsOut,
        create_schema=NewsCreate, update_schema=NewsUpdate, slug_field="slug",
        public_prefix="/novosti"),
    "faq": make_content_router(
        path="faq", model=Faq, out_schema=FaqOut,
        create_schema=FaqCreate, update_schema=FaqUpdate),
    "advantages": make_content_router(
        path="advantages", model=Advantage, out_schema=AdvantageOut,
        create_schema=AdvantageCreate, update_schema=AdvantageUpdate),
    "partners": make_content_router(
        path="partners", model=Partner, out_schema=PartnerOut,
        create_schema=PartnerCreate, update_schema=PartnerUpdate),
    "team": make_content_router(
        path="team", model=TeamMember, out_schema=TeamMemberOut,
        create_schema=TeamMemberCreate, update_schema=TeamMemberUpdate),
    "documents": make_content_router(
        path="documents", model=Document, out_schema=DocumentOut,
        create_schema=DocumentCreate, update_schema=DocumentUpdate, slug_field="slug",
        public_prefix="/dokumenty",
        before_write=_policy_before_write, before_delete=_policy_before_delete),
    # Сущности без фичефлага (ключ отсутствует в _CONTENT_FLAGS → включены всегда)
    "plan_categories": make_content_router(
        path="plan-categories", model=PlanCategory, out_schema=PlanCategoryOut,
        create_schema=PlanCategoryCreate, update_schema=PlanCategoryUpdate, slug_field="slug",
        public_prefix="/planirovki", annotate=_annotate_floorplans_count),
    "facts": make_content_router(
        path="facts", model=Fact, out_schema=FactOut,
        create_schema=FactCreate, update_schema=FactUpdate),
    "site_texts": make_content_router(
        path="site-texts", model=SiteText, out_schema=SiteTextOut,
        create_schema=SiteTextCreate, update_schema=SiteTextUpdate, slug_field="key"),
    "hero_chapters": make_content_router(
        path="hero-chapters", model=HeroChapter, out_schema=HeroChapterOut,
        create_schema=HeroChapterCreate, update_schema=HeroChapterUpdate),
}
