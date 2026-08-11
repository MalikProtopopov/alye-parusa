"""Админ-эндпоинты. RBAC (З12): admin (Суперадмин) — всё; manager — только заявки."""
import csv
import io
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import (
    AdminUser, AppSettings, Banner, Contacts, Document, Floorplan, HeroChapter,
    Lead, PlanCategory, SeoMeta,
)
from ..notify import send_telegram, telegram_configured
from ..redirects import record_slug_redirect
from ..schemas import (
    BannerOut, BannerUpdate, ContactsOut, ContactsUpdate, FloorplanCreate,
    FloorplanOut, FloorplanUpdate, LeadOut, LeadPatch, LoginIn, MeOut,
    ReorderItem, SettingsOut, SettingsUpdate, TokenOut,
)
from ..security import (
    create_access_token, get_current_user, require_role, verify_password,
)

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

admin_only = require_role("admin")           # Суперадмин
staff = require_role("admin", "manager")     # Суперадмин + Менеджер (заявки)


# ─────────────────────────── Auth ───────────────────────────


@router.post("/auth/login", response_model=TokenOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    from sqlalchemy import func as _f

    # Email без учёта регистра и пробелов: автокапитализация на телефоне
    # не должна выглядеть как «неверный пароль»
    email = (payload.email or "").strip().lower()
    user = db.scalar(select(AdminUser).where(_f.lower(AdminUser.email) == email))
    if user is None or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    token = create_access_token(sub=str(user.id), role=user.role)
    return TokenOut(access_token=token, role=user.role)


@router.get("/auth/me", response_model=MeOut)
def me(user: AdminUser = Depends(get_current_user)):
    return user


# ─────────────────────────── Заявки (admin + manager) ───────────────────────────


@router.get("/stats")
def get_stats(db: Session = Depends(get_db), _: AdminUser = Depends(staff)):
    """Дашборд «Обзор»: агрегаты по заявкам (first-party аналитика продаж).
    Доступен и менеджеру — это его рабочие цифры."""
    from datetime import datetime, timedelta, timezone

    from sqlalchemy import Numeric, cast, func

    from ..models import Floorplan

    now = datetime.now(timezone.utc)
    d7 = now - timedelta(days=7)
    d30 = now - timedelta(days=30)

    total = db.scalar(select(func.count()).select_from(Lead)) or 0
    last7 = db.scalar(select(func.count()).select_from(Lead).where(Lead.created_at >= d7)) or 0
    last30 = db.scalar(select(func.count()).select_from(Lead).where(Lead.created_at >= d30)) or 0

    by_status = dict(db.execute(select(Lead.status, func.count()).group_by(Lead.status)).all())

    # Динамика по дням (30 дней, пропуски заполняем нулями)
    day = func.date_trunc("day", Lead.created_at)
    daily_raw = dict(
        (d.date().isoformat(), c)
        for d, c in db.execute(
            select(day, func.count()).where(Lead.created_at >= d30).group_by(day)
        ).all()
    )
    daily = []
    for i in range(29, -1, -1):
        dt = (now - timedelta(days=i)).date().isoformat()
        daily.append({"date": dt, "count": daily_raw.get(dt, 0)})

    def top(col, limit=8):
        rows = db.execute(
            select(col, func.count().label("c"))
            .where(col.isnot(None))
            .group_by(col)
            .order_by(func.count().desc())
            .limit(limit)
        ).all()
        return [{"label": r[0], "count": r[1]} for r in rows]

    by_kind = top(Lead.kind)
    by_block = top(Lead.source_block)
    utm_src = Lead.utm["utm_source"].astext
    by_utm = [
        {"label": r[0], "count": r[1]}
        for r in db.execute(
            select(utm_src, func.count())
            .where(utm_src.isnot(None))
            .group_by(utm_src)
            .order_by(func.count().desc())
            .limit(8)
        ).all()
    ]

    by_floorplan = [
        {"label": r[0], "count": r[1]}
        for r in db.execute(
            select(Floorplan.title, func.count())
            .join(Lead, Lead.floorplan_id == Floorplan.id)
            .group_by(Floorplan.title)
            .order_by(func.count().desc())
            .limit(6)
        ).all()
    ]

    # calc_snapshot: отсекаем и SQL NULL, и легаси JSON null.
    # Форма снапшота рассрочки: {"input": CalcRequest, "result": CalcResult}
    has_calc = (Lead.calc_snapshot.isnot(None)) & (func.jsonb_typeof(Lead.calc_snapshot) != "null")
    with_calc = db.scalar(select(func.count()).select_from(Lead).where(has_calc)) or 0
    avg_price = db.scalar(
        select(func.avg(cast(Lead.calc_snapshot["result"]["price"].astext, Numeric))).where(has_calc)
    )
    avg_monthly = db.scalar(
        select(func.avg(cast(Lead.calc_snapshot["result"]["monthly_payment"].astext, Numeric))).where(has_calc)
    )

    done = by_status.get("done", 0)
    return {
        "totals": {"total": total, "last7": last7, "last30": last30},
        "by_status": {
            "new": by_status.get("new", 0),
            "in_progress": by_status.get("in_progress", 0),
            "done": done,
        },
        "done_rate": round(done / total * 100, 1) if total else 0.0,
        "daily": daily,
        "by_kind": by_kind,
        "by_block": by_block,
        "by_utm": by_utm,
        "by_floorplan": by_floorplan,
        "calc": {
            "with_calc": with_calc,
            "avg_price": round(float(avg_price), 0) if avg_price is not None else None,
            "avg_monthly_payment": round(float(avg_monthly), 0) if avg_monthly is not None else None,
        },
    }


def _leads_query(db: Session, status: str | None):
    q = select(Lead).order_by(Lead.created_at.desc())
    if status:
        q = q.where(Lead.status == status)
    return db.scalars(q).all()


def _lead_out(lead: Lead) -> LeadOut:
    """LeadOut + название планировки (joined-relationship) вместо голого UUID."""
    out = LeadOut.model_validate(lead)
    out.floorplan_title = lead.floorplan.title if lead.floorplan else None
    return out


@router.get("/leads", response_model=list[LeadOut])
def list_leads(
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _: AdminUser = Depends(staff),
):
    return [_lead_out(l) for l in _leads_query(db, status)]


@router.get("/leads/count")
def count_leads(
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _: AdminUser = Depends(staff),
):
    """Лёгкий счётчик для бейджа «новых: N» в сайдбаре админки."""
    from sqlalchemy import func

    q = select(func.count()).select_from(Lead)
    if status:
        q = q.where(Lead.status == status)
    return {"count": db.scalar(q) or 0}


@router.get("/leads/export")
def export_leads(
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _: AdminUser = Depends(staff),
):
    """Выгрузка заявок в CSV (L5). BOM + разделитель ';' для корректного Excel."""
    rows = _leads_query(db, status)
    buf = io.StringIO()
    buf.write("﻿")
    w = csv.writer(buf, delimiter=";")

    def safe(value) -> str:
        """Защита от formula injection в Excel: данные приходят от посетителей."""
        s = str(value or "")
        return "'" + s if s[:1] in ("=", "+", "-", "@") else s

    w.writerow(["Дата (UTC)", "Имя", "Телефон", "Тип", "Статус", "Блок", "Кнопка", "UTM", "Заметки"])
    for l in rows:
        w.writerow([
            l.created_at.strftime("%d.%m.%Y %H:%M"), safe(l.name), safe(l.phone),
            l.kind, l.status, safe(l.source_block), safe(l.source_button),
            safe("; ".join(f"{k}={v}" for k, v in (l.utm or {}).items())), safe(l.notes),
        ])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=leads.csv"},
    )


@router.get("/leads/{lead_id}", response_model=LeadOut)
def get_lead(lead_id: uuid.UUID, db: Session = Depends(get_db), _: AdminUser = Depends(staff)):
    lead = db.get(Lead, lead_id)
    if lead is None:
        raise HTTPException(status_code=404, detail="not_found")
    return _lead_out(lead)


@router.patch("/leads/{lead_id}", response_model=LeadOut)
def patch_lead(
    lead_id: uuid.UUID,
    payload: LeadPatch,
    db: Session = Depends(get_db),
    _: AdminUser = Depends(staff),
):
    lead = db.get(Lead, lead_id)
    if lead is None:
        raise HTTPException(status_code=404, detail="not_found")
    if payload.status is not None:
        lead.status = payload.status
    if payload.notes is not None:
        lead.notes = payload.notes
    db.commit()
    db.refresh(lead)
    return _lead_out(lead)


@router.delete("/leads/{lead_id}", status_code=204)
def delete_lead(lead_id: uuid.UUID, db: Session = Depends(get_db), _: AdminUser = Depends(admin_only)):
    """Удаление заявки — право на удаление ПДн (152-ФЗ). Только Суперадмин."""
    lead = db.get(Lead, lead_id)
    if lead is None:
        raise HTTPException(status_code=404, detail="not_found")
    db.delete(lead)
    db.commit()


# ─────────────────────────── Планировки CRUD (admin) ───────────────────────────


@router.get("/floorplans", response_model=list[FloorplanOut])
def admin_list_floorplans(db: Session = Depends(get_db), _: AdminUser = Depends(admin_only)):
    return list(db.scalars(select(Floorplan).order_by(Floorplan.sort)).all())


@router.post("/floorplans/reorder", status_code=204)
def admin_reorder_floorplans(items: list[ReorderItem], db: Session = Depends(get_db), _: AdminUser = Depends(admin_only)):
    """Массовая смена порядка (drag-n-drop в админке)."""
    by_id = {i.id: i.sort for i in items}
    for fp in db.scalars(select(Floorplan).where(Floorplan.id.in_(by_id))).all():
        fp.sort = by_id[fp.id]
    db.commit()


@router.get("/floorplans/{fp_id}", response_model=FloorplanOut)
def admin_get_floorplan(fp_id: uuid.UUID, db: Session = Depends(get_db), _: AdminUser = Depends(admin_only)):
    fp = db.get(Floorplan, fp_id)
    if fp is None:
        raise HTTPException(status_code=404, detail="not_found")
    return fp


@router.post("/floorplans", response_model=FloorplanOut, status_code=201)
def admin_create_floorplan(payload: FloorplanCreate, db: Session = Depends(get_db), _: AdminUser = Depends(admin_only)):
    if db.scalar(select(Floorplan).where(Floorplan.slug == payload.slug)):
        raise HTTPException(status_code=409, detail="slug_exists")
    fp = Floorplan(**payload.model_dump())
    db.add(fp)
    try:
        db.commit()
    except IntegrityError:  # гонка: тот же slug проскочил проверку
        db.rollback()
        raise HTTPException(status_code=409, detail="slug_exists")
    db.refresh(fp)
    return fp


@router.put("/floorplans/{fp_id}", response_model=FloorplanOut)
def admin_update_floorplan(
    fp_id: uuid.UUID, payload: FloorplanUpdate, db: Session = Depends(get_db), _: AdminUser = Depends(admin_only)
):
    fp = db.get(Floorplan, fp_id)
    if fp is None:
        raise HTTPException(status_code=404, detail="not_found")
    data = payload.model_dump(exclude_unset=True)
    old_slug = fp.slug
    if "slug" in data and data["slug"] != fp.slug:
        if db.scalar(select(Floorplan).where(Floorplan.slug == data["slug"])):
            raise HTTPException(status_code=409, detail="slug_exists")
    for k, v in data.items():
        setattr(fp, k, v)
    # Авто-301: публичный адрес планировки сменился
    if data.get("slug") and data["slug"] != old_slug:
        record_slug_redirect(db, "/planirovki", old_slug, data["slug"])
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="slug_exists")
    db.refresh(fp)
    return fp


@router.delete("/floorplans/{fp_id}", status_code=204)
def admin_delete_floorplan(fp_id: uuid.UUID, db: Session = Depends(get_db), _: AdminUser = Depends(admin_only)):
    fp = db.get(Floorplan, fp_id)
    if fp is None:
        raise HTTPException(status_code=404, detail="not_found")
    db.delete(fp)
    db.commit()


# ─────────────────────────── Баннер / Контакты / Настройки (admin) ───────────────────────────


@router.get("/banner", response_model=BannerOut)
def admin_get_banner(db: Session = Depends(get_db), _: AdminUser = Depends(admin_only)):
    return db.get(Banner, 1) or Banner(id=1)


@router.put("/banner", response_model=BannerOut)
def admin_put_banner(payload: BannerUpdate, db: Session = Depends(get_db), _: AdminUser = Depends(admin_only)):
    b = db.get(Banner, 1)
    if b is None:
        b = Banner(id=1)
        db.add(b)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(b, k, v)
    db.commit()
    db.refresh(b)
    return b


@router.get("/contacts", response_model=ContactsOut)
def admin_get_contacts(db: Session = Depends(get_db), _: AdminUser = Depends(admin_only)):
    return db.get(Contacts, 1) or Contacts(id=1)


@router.put("/contacts", response_model=ContactsOut)
def admin_put_contacts(payload: ContactsUpdate, db: Session = Depends(get_db), _: AdminUser = Depends(admin_only)):
    c = db.get(Contacts, 1)
    if c is None:
        c = Contacts(id=1)
        db.add(c)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return c


def _settings_out(s: AppSettings | None) -> SettingsOut:
    out = (
        SettingsOut.model_validate(s)
        if s is not None
        # фолбэк с явными дефолтами: transient AppSettings(id=1) не применяет
        # column defaults до flush, поэтому строим схему напрямую
        else SettingsOut(show_prices=True, notify_channel="telegram")
    )
    out.telegram_configured = telegram_configured()
    return out


@router.get("/settings", response_model=SettingsOut)
def admin_get_settings(db: Session = Depends(get_db), _: AdminUser = Depends(admin_only)):
    return _settings_out(db.get(AppSettings, 1))


@router.put("/settings", response_model=SettingsOut)
def admin_put_settings(payload: SettingsUpdate, db: Session = Depends(get_db), _: AdminUser = Depends(admin_only)):
    s = db.get(AppSettings, 1)
    if s is None:
        s = AppSettings(id=1)
        db.add(s)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return _settings_out(s)


@router.post("/settings/test-notification")
def test_notification(_: AdminUser = Depends(admin_only)):
    """Проверка Telegram-бота из админки."""
    if not telegram_configured():
        raise HTTPException(status_code=400, detail="telegram_not_configured")
    if not send_telegram("✅ Тестовое уведомление из админки «Алые Паруса»"):
        raise HTTPException(status_code=502, detail="telegram_send_failed")
    return {"ok": True}


# ─────────────────────────── Здоровье контента ───────────────────────────


@router.get("/health")
def content_health(db: Session = Depends(get_db), _: AdminUser = Depends(admin_only)):
    """Проверки состояния контента для панели на дашборде."""
    from sqlalchemy import func

    checks: list[dict] = []

    policy = db.scalar(
        select(func.count()).select_from(Document).where(
            Document.is_policy.is_(True), Document.active.is_(True)
        )
    ) or 0
    checks.append({
        "id": "policy_active", "status": "ok" if policy >= 1 else "warn",
        "label": "Политика конфиденциальности",
        "detail": "Активная Политика назначена" if policy >= 1
                  else "Нет активной Политики — согласие у форм на сайте не работает",
        "link": "/documents",
    })

    hero = db.scalar(
        select(func.count()).select_from(HeroChapter).where(HeroChapter.active.is_(True))
    ) or 0
    checks.append({
        "id": "hero_chapters", "status": "ok" if hero == 6 else "warn",
        "label": f"Главы hero: {hero} из 6",
        "detail": "Сайт показывает тексты из CMS" if hero == 6
                  else "Сайт показывает стандартные тексты (нужно ровно 6 активных глав)",
        "link": "/hero-chapters",
    })

    empty_cats = [
        c.title for c in db.scalars(select(PlanCategory).where(PlanCategory.active.is_(True))).all()
        if not db.scalar(select(func.count()).select_from(Floorplan).where(
            Floorplan.category_id == c.id, Floorplan.active.is_(True)))
    ]
    checks.append({
        "id": "empty_categories", "status": "ok" if not empty_cats else "warn",
        "label": "Пустые категории каталога", "count": len(empty_cats),
        "detail": ", ".join(empty_cats) if empty_cats else "Во всех категориях есть планировки",
        "link": "/plan-categories",
    })

    uncat = db.scalar(
        select(func.count()).select_from(Floorplan).where(
            Floorplan.active.is_(True), Floorplan.category_id.is_(None))
    ) or 0
    checks.append({
        "id": "uncategorized_plans", "status": "ok" if uncat == 0 else "warn",
        "label": "Планировки без категории", "count": uncat,
        "detail": "Не попадают в фильтры каталога" if uncat else "Все планировки распределены",
        "link": "/floorplans",
    })

    no_image = db.scalar(
        select(func.count()).select_from(Floorplan).where(
            Floorplan.active.is_(True), Floorplan.image_url.is_(None))
    ) or 0
    checks.append({
        "id": "plans_no_image", "status": "ok" if no_image == 0 else "warn",
        "label": "Планировки без чертежа", "count": no_image,
        "detail": "Карточки на сайте без изображения" if no_image else "У всех планировок есть чертёж",
        "link": "/floorplans",
    })

    valid_paths = {"/", "/planirovki", "/novosti", "/dokumenty"}
    valid_paths |= {f"/planirovki/{s}" for s in db.scalars(select(PlanCategory.slug)).all()}
    valid_paths |= {f"/planirovki/{s}" for s in db.scalars(select(Floorplan.slug)).all()}
    from ..models import News
    valid_paths |= {f"/novosti/{s}" for s in db.scalars(select(News.slug)).all()}
    valid_paths |= {f"/dokumenty/{s}" for s in db.scalars(select(Document.slug)).all()}
    orphans = [s for s in db.scalars(select(SeoMeta.slug)).all() if s not in valid_paths]
    checks.append({
        "id": "seo_orphans", "status": "ok" if not orphans else "warn",
        "label": "SEO-записи без страниц", "count": len(orphans),
        "detail": ", ".join(orphans[:5]) if orphans else "Все SEO-записи привязаны к страницам",
        "link": "/seo",
    })

    return {"checks": checks}
