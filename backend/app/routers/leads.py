"""Приём заявок (L1/L2). Работает автономно от CMS/админки."""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import AppSettings, Floorplan, Lead
from ..notify import notify_new_lead
from ..schemas import LeadAccepted, LeadCreate

router = APIRouter(prefix="/api/v1", tags=["leads"])
log = logging.getLogger("leads")

DEFAULT_CONSENT_TEXT = (
    "Я согласен(а) на обработку персональных данных в соответствии с "
    "Политикой конфиденциальности (152-ФЗ)."
)


@router.post("/leads", response_model=LeadAccepted, status_code=201)
def create_lead(
    payload: LeadCreate,
    request: Request,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
):
    # honeypot: заполнено ботом → отвечаем «успехом», но не пишем в БД
    if payload.website:
        return LeadAccepted(id="00000000-0000-0000-0000-000000000000")  # type: ignore[arg-type]

    # IP как вспомогательная метадата согласия. В демо берём адрес соединения;
    # X-Forwarded-For доверяется только за известным reverse-proxy (в проде —
    # uvicorn --forwarded-allow-ips), поэтому здесь на заголовок не полагаемся.
    ip = request.client.host if request.client else None

    # Мягкая деградация: если планировка указана, но не найдена (удалена/битый id) —
    # не теряем заявку, просто отвязываем floorplan_id.
    floorplan_id = payload.floorplan_id
    if floorplan_id is not None and db.get(Floorplan, floorplan_id) is None:
        floorplan_id = None

    lead = Lead(
        name=payload.name,
        phone=payload.phone,
        kind=payload.kind,
        floorplan_id=floorplan_id,
        message=payload.message,
        consent_given=True,
        consent_text=payload.consent_text or DEFAULT_CONSENT_TEXT,
        consent_at=datetime.now(timezone.utc),
        ip_address=ip,
        utm=payload.utm,
        source_button=payload.source_button,
        source_block=payload.source_block,
        page_url=payload.page_url,
        calc_snapshot=payload.calc_snapshot,
        status="new",
    )
    db.add(lead)
    try:
        db.commit()
    except IntegrityError:
        # страховка от гонки (напр. FK отвалился между проверкой и commit) —
        # приоритет в том, чтобы принять заявку, а не отдать 500
        db.rollback()
        lead.floorplan_id = None
        db.add(lead)
        db.commit()
    db.refresh(lead)

    # Уведомление — фоном, plain-dict (после ответа сессия закрыта)
    app_settings = db.get(AppSettings, 1)
    fp = db.get(Floorplan, lead.floorplan_id) if lead.floorplan_id else None
    # calc_snapshot — free-form JSONB с клиента: вложенный result может быть чем угодно
    monthly = None
    if isinstance(lead.calc_snapshot, dict):
        result = lead.calc_snapshot.get("result")
        if isinstance(result, dict):
            value = result.get("monthly_payment")
            monthly = value if isinstance(value, (int, float)) else None
    background.add_task(notify_new_lead, {
        "channel": app_settings.notify_channel if app_settings else None,
        "lead_id": str(lead.id),
        "name": lead.name,
        "phone": lead.phone,
        "kind": lead.kind,
        "source_block": lead.source_block,
        "source_button": lead.source_button,
        "floorplan_title": fp.title if fp else None,
        "monthly_payment": monthly,
    })
    log.info("NEW LEAD %s: %s / %s (kind=%s, block=%s)",
             lead.id, lead.name, lead.phone, lead.kind, lead.source_block)
    return LeadAccepted(id=lead.id)
