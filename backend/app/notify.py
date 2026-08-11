"""Уведомления о новых заявках (З13). Telegram Bot API; отказоустойчиво:
любая ошибка отправки логируется и не влияет на приём заявки."""
import html
import logging

import httpx

from .config import settings

log = logging.getLogger("app.notify")

KIND_RU = {
    "simple_callback": "Обратный звонок",
    "with_calc": "С расчётом рассрочки",
    "without_calc": "Без расчёта",
    "presentation": "Презентация",
    "floorplan": "По планировке",
}


def telegram_configured() -> bool:
    return bool(settings.telegram_bot_token and settings.telegram_chat_id)


def send_telegram(text: str) -> bool:
    """True при успешной отправке. Не бросает исключений."""
    if not telegram_configured():
        log.info("Telegram не настроен — уведомление пропущено")
        return False
    try:
        resp = httpx.post(
            f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage",
            json={
                "chat_id": settings.telegram_chat_id,
                "text": text,
                "parse_mode": "HTML",
                "disable_web_page_preview": True,
            },
            timeout=5.0,
        )
        if resp.status_code != 200:
            log.warning("Telegram ответил %s: %s", resp.status_code, resp.text[:200])
            return False
        return True
    except Exception as exc:  # сеть/таймаут — заявку не блокируем
        log.warning("Ошибка отправки в Telegram: %s", exc)
        return False


def _fmt_price(value: float) -> str:
    return f"{value:,.0f}".replace(",", " ") + " ₽"


def _esc(value) -> str:
    """Пользовательский текст в HTML-сообщение только через экранирование:
    иначе «<» в имени/источнике ломает parse_mode=HTML (Telegram отклонит
    сообщение и уведомление потеряется), а посетитель сможет внедрить разметку."""
    return html.escape(str(value or ""), quote=True)


def format_lead_message(data: dict) -> str:
    """data — plain-dict (не ORM): name, phone, kind, source_block, source_button,
    floorplan_title, monthly_payment, lead_id."""
    kind = KIND_RU.get(data.get("kind"), data.get("kind", ""))
    lines = [f"🔔 <b>Новая заявка</b> — {_esc(kind)}"]
    lines.append(f"Имя: {_esc(data.get('name') or '—')}")
    phone = data.get("phone") or ""
    if phone:
        lines.append(f'Телефон: <a href="tel:{_esc(phone)}">{_esc(phone)}</a>')
    if data.get("floorplan_title"):
        lines.append(f"Планировка: {_esc(data['floorplan_title'])}")
    monthly = data.get("monthly_payment")
    if isinstance(monthly, (int, float)) and monthly > 0:
        lines.append(f"Платёж по рассрочке: {_fmt_price(float(monthly))}/мес")
    source = " · ".join(filter(None, [data.get("source_block"), data.get("source_button")]))
    if source:
        lines.append(f"Источник: {_esc(source)}")
    if data.get("lead_id"):
        lines.append(f'\n<a href="{settings.admin_url}/leads?lead={_esc(data["lead_id"])}">Открыть в админке</a>')
    return "\n".join(lines)


def notify_new_lead(data: dict) -> None:
    """Фоновая задача после commit заявки. Канал берётся из data['channel']."""
    channel = data.get("channel") or settings.notify_channel
    if channel == "telegram":
        send_telegram(format_lead_message(data))
    else:
        log.info("NEW LEAD [%s] уведомление выключено (канал: %s)", data.get("lead_id"), channel)
