"""Алые Паруса API — точка входа.

Локальный демо-режим: на старте создаёт таблицы и заливает seed-данные,
чтобы `docker-compose up` дал сразу рабочий, наполненный сайт.
В проде схема управляется Alembic-миграциями (см. раздел 07 ТЗ)."""
import logging
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from .config import settings
from .db import Base, SessionLocal, engine
from .routers import admin, calc, content, leads, media, public, redirects, seo
from .seed import seed
from .slug import backfill_document_slugs

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("app")

app = FastAPI(title="Алые Паруса API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(public.router)
app.include_router(leads.router)
app.include_router(admin.router)
app.include_router(media.router)
# Отдача самих файлов (диск или MinIO/S3) — публично, через тот же домен API
app.include_router(media.public_router)
# Редиректы — базовая SEO-механика, без фичефлага
app.include_router(redirects.router)

# Контентные блоки — подключаются только если фичефлаг включён (.env).
# Сущностей без ключа здесь (категории, факты, тексты, hero-главы) флаги не касаются.
_CONTENT_FLAGS = {
    "news": settings.feature_news,
    "faq": settings.feature_faq,
    "advantages": settings.feature_advantages,
    "partners": settings.feature_partners,
    "team": settings.feature_team,
    "documents": settings.feature_documents,
}
for _key, _router in content.CONTENT_ROUTERS.items():
    if _CONTENT_FLAGS.get(_key, True):
        app.include_router(_router)
if settings.feature_calculator:
    app.include_router(calc.router)
if settings.feature_seo_admin:
    app.include_router(seo.router)


def _wait_for_db(retries: int = 30, delay: float = 1.0) -> None:
    for attempt in range(1, retries + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return
        except OperationalError:
            log.info("Ожидание БД… (%d/%d)", attempt, retries)
            time.sleep(delay)
    raise RuntimeError("БД недоступна")


@app.on_event("startup")
def on_startup() -> None:
    _wait_for_db()
    Base.metadata.create_all(bind=engine)
    # create_all не добавляет/не удаляет колонки в существующих таблицах — лёгкие demo-миграции:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE document ADD COLUMN IF NOT EXISTS description TEXT"))
        conn.execute(text("ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS metrika_id VARCHAR(32)"))
        # «Алые Паруса»: слаги документов, категории планировок, факты/тексты, рассрочка
        conn.execute(text("ALTER TABLE document ADD COLUMN IF NOT EXISTS slug VARCHAR(255)"))
        conn.execute(text("ALTER TABLE advantage ADD COLUMN IF NOT EXISTS category VARCHAR(32)"))
        conn.execute(text("ALTER TABLE contacts ADD COLUMN IF NOT EXISTS cadastral_number VARCHAR(64)"))
        conn.execute(text(
            "ALTER TABLE floorplan ADD COLUMN IF NOT EXISTS category_id UUID "
            "REFERENCES plan_category(id) ON DELETE SET NULL"
        ))
        conn.execute(text("ALTER TABLE floorplan DROP COLUMN IF EXISTS plan_type"))
        conn.execute(text("DROP TABLE IF EXISTS construction_update"))
        # Калькулятор: рассрочка вместо доходности
        conn.execute(text(
            "ALTER TABLE calculator_params "
            "ADD COLUMN IF NOT EXISTS min_down_payment_pct NUMERIC(5,4) NOT NULL DEFAULT 0.30, "
            "ADD COLUMN IF NOT EXISTS max_down_payment_pct NUMERIC(5,4) NOT NULL DEFAULT 0.90, "
            "ADD COLUMN IF NOT EXISTS term_min_months INTEGER NOT NULL DEFAULT 6, "
            "ADD COLUMN IF NOT EXISTS term_max_months INTEGER NOT NULL DEFAULT 36, "
            "ADD COLUMN IF NOT EXISTS term_step_months INTEGER NOT NULL DEFAULT 6, "
            "ADD COLUMN IF NOT EXISTS markup_pct_annual NUMERIC(6,4) NOT NULL DEFAULT 0.0"
        ))
        conn.execute(text(
            "ALTER TABLE calculator_params "
            "DROP COLUMN IF EXISTS model, DROP COLUMN IF EXISTS yield_rate, "
            "DROP COLUMN IF EXISTS occupancy, DROP COLUMN IF EXISTS adr, "
            "DROP COLUMN IF EXISTS mgmt_fee, DROP COLUMN IF EXISTS horizon_years"
        ))
        # SEO-волна: noindex, описания категорий, верификация вебмастеров
        conn.execute(text("ALTER TABLE seo_meta ADD COLUMN IF NOT EXISTS noindex BOOLEAN NOT NULL DEFAULT FALSE"))
        conn.execute(text("ALTER TABLE plan_category ADD COLUMN IF NOT EXISTS description TEXT"))
        conn.execute(text("ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS yandex_verification VARCHAR(128)"))
        conn.execute(text("ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS google_verification VARCHAR(128)"))
        # Медиа: абсолютные ссылки старого формата (http://host:port/media/...)
        # ломались при смене окружения — переводим в относительные «/media/...»
        _media_cols = [
            ("floorplan", "image_url"), ("news", "cover_image_url"),
            ("advantage", "image_url"), ("partner", "logo_url"),
            ("team_member", "photo_url"), ("document", "file_url"),
            ("banner", "background_url"), ("seo_meta", "og_image_url"),
        ]
        for _t, _c in _media_cols:
            conn.execute(text(
                f"UPDATE {_t} SET {_c} = '/media/' || split_part({_c}, '/media/', 2) "
                f"WHERE {_c} LIKE 'http%/media/%'"
            ))
    # Бэкфилл слагов документов (перенос со старой схемы) — до SET NOT NULL
    with SessionLocal() as db:
        backfill_document_slugs(db)
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE document ALTER COLUMN slug SET NOT NULL"))
        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_document_slug ON document (slug)"))
    with SessionLocal() as db:
        seed(db)
    log.info("Старт завершён: таблицы созданы, seed применён.")


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}
