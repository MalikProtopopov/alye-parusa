"""ORM-модели. Демо-подмножество схемы из раздела 03 (вертикальный срез:
планировки, баннер, контакты, настройки, заявки, админ-пользователи).
PK — UUID (канон 09). Singleton-таблицы держат одну строку с id=1."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, CheckConstraint, DateTime, ForeignKey, Integer, Numeric, String, Text, func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


def _now() -> datetime:
    return datetime.now(timezone.utc)


class AdminUser(Base):
    __tablename__ = "admin_user"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    # З12: admin = Суперадмин (все права) / manager = Менеджер (только заявки)
    role: Mapped[str] = mapped_column(String(16), nullable=False, default="admin")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PlanCategory(Base):
    """Категория планировок — ЧПУ-фильтр каталога (/planirovki/{slug})."""
    __tablename__ = "plan_category"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    # Вводный текст страницы категории /planirovki/<slug> (rich, санитизируется) —
    # уникальный контент против «тонких» страниц фильтров
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=_now)


class Floorplan(Base):
    __tablename__ = "floorplan"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("plan_category.id", ondelete="SET NULL"), nullable=True
    )
    category: Mapped["PlanCategory | None"] = relationship(lazy="joined")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    area_m2: Mapped[float] = mapped_column(Numeric(7, 2), nullable=False)
    price: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    # З5: показ статуса — отдельная фича; поле в схеме уже есть
    availability_status: Mapped[str] = mapped_column(String(16), nullable=False, default="available")
    floor: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ceiling_height: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)  # демо: URL вместо медиа-пайплайна
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=_now)


class Banner(Base):
    """Singleton (id=1). Баннер первого экрана с двойным оффером (S2)."""
    __tablename__ = "banner"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    eyebrow: Mapped[str | None] = mapped_column(String(255), nullable=True)
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    subtitle: Mapped[str | None] = mapped_column(Text, nullable=True)
    cta_primary_label: Mapped[str | None] = mapped_column(String(120), nullable=True)
    cta_primary_target: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cta_secondary_label: Mapped[str | None] = mapped_column(String(120), nullable=True)
    cta_secondary_target: Mapped[str | None] = mapped_column(String(255), nullable=True)
    background_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=_now)


class Contacts(Base):
    """Singleton (id=1). NAP (US-2.1)."""
    __tablename__ = "contacts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    telegram: Mapped[str | None] = mapped_column(String(255), nullable=True)
    whatsapp: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    work_hours: Mapped[str | None] = mapped_column(String(255), nullable=True)
    map_embed: Mapped[str | None] = mapped_column(Text, nullable=True)
    inn: Mapped[str | None] = mapped_column(String(32), nullable=True)
    ogrn: Mapped[str | None] = mapped_column(String(32), nullable=True)
    cadastral_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=_now)


class AppSettings(Base):
    """Singleton (id=1). Фичефлаги/каналы (раздел 03.4.15)."""
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    # З6: глобальный фичефлаг цены
    show_prices: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # З13: по умолчанию telegram
    notify_channel: Mapped[str] = mapped_column(String(16), nullable=False, default="telegram")
    # X2: счётчик Яндекс.Метрики; на клиенте инициализируется только после
    # согласия в cookie-баннере (152-ФЗ)
    metrika_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    # Коды подтверждения прав на сайт (значение content мета-тега)
    yandex_verification: Mapped[str | None] = mapped_column(String(128), nullable=True)
    google_verification: Mapped[str | None] = mapped_column(String(128), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=_now)


class Lead(Base):
    """Заявка (L2). Приём работает автономно; согласие 152-ФЗ фиксируется денормализованно."""
    __tablename__ = "lead"
    # 152-ФЗ: заявка без согласия в БД не пишется (инвариант и на уровне БД)
    __table_args__ = (CheckConstraint("consent_given = true", name="ck_lead_consent_true"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(32), nullable=False)
    kind: Mapped[str] = mapped_column(String(24), nullable=False, default="simple_callback")
    floorplan_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("floorplan.id", ondelete="SET NULL"), nullable=True
    )
    floorplan: Mapped["Floorplan | None"] = relationship(lazy="joined")
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 152-ФЗ
    consent_given: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    consent_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Атрибуция (L3)
    utm: Mapped[dict | None] = mapped_column(JSONB(none_as_null=True), nullable=True)
    source_button: Mapped[str | None] = mapped_column(String(120), nullable=True)
    source_block: Mapped[str | None] = mapped_column(String(120), nullable=True)
    page_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    calc_snapshot: Mapped[dict | None] = mapped_column(JSONB(none_as_null=True), nullable=True)
    # Обработка менеджером
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="new")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ─────────────────────── КОНТЕНТНЫЕ БЛОКИ (CMS) ───────────────────────


class News(Base):
    """Новости (S7). Отдельные страницы по слагу (З7)."""
    __tablename__ = "news"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    excerpt: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=_now)


class Faq(Base):
    """Вопрос-ответ (S11)."""
    __tablename__ = "faq"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    question: Mapped[str] = mapped_column(String(500), nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=_now)


class Advantage(Base):
    """Преимущества с фото (S4)."""
    __tablename__ = "advantage"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    text: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    # Группа карточек на главной: living | leisure | infrastructure
    category: Mapped[str | None] = mapped_column(String(32), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=_now)


class Partner(Base):
    """Партнёры (S5)."""
    __tablename__ = "partner"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    logo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=_now)


class TeamMember(Base):
    """Команда (S6)."""
    __tablename__ = "team_member"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str | None] = mapped_column(String(255), nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=_now)


class Document(Base):
    """Документы (S12/US-13.1). Заказчик загружает сам; выводятся в футере.
    doc_type: permit/declaration/policy/link/other. is_policy — привязка чекбокса согласия."""
    __tablename__ = "document"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    doc_type: Mapped[str] = mapped_column(String(24), nullable=False, default="other")
    # Аннотация для публичной страницы /dokumenty (rich-текст, санитизируется)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    # ровно один документ помечается как Политика конфиденциальности — на него
    # ссылается чекбокс согласия у форм (152-ФЗ)
    is_policy: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=_now)


class Fact(Base):
    """Короткие пары «подпись — значение» в лентах фактов на главной.
    group: about (цифры проекта) | trust (доверие) | nearby (рядом) | investment (метрики)."""
    __tablename__ = "fact"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    group: Mapped[str] = mapped_column(String(32), nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    value: Mapped[str] = mapped_column(String(64), nullable=False)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=_now)


class SiteText(Base):
    """Тексты секций сайта (заголовок/надзаголовок/подводка) по ключу секции."""
    __tablename__ = "site_text"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    eyebrow: Mapped[str | None] = mapped_column(String(255), nullable=True)
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    lead: Mapped[str | None] = mapped_column(Text, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=_now)


class HeroChapter(Base):
    """Текстовые главы скролл-hero главной (тайминги остаются статикой во фронте)."""
    __tablename__ = "hero_chapter"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    eyebrow: Mapped[str | None] = mapped_column(String(255), nullable=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    subtitle: Mapped[str | None] = mapped_column(Text, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=_now)


class CalculatorParams(Base):
    """Параметры калькулятора рассрочки (X1). Singleton id=1.
    Все проценты — доли 0..1 (0.30 = 30 %)."""
    __tablename__ = "calculator_params"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    min_down_payment_pct: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False, default=0.30)
    max_down_payment_pct: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False, default=0.90)
    term_min_months: Mapped[int] = mapped_column(Integer, nullable=False, default=6)
    term_max_months: Mapped[int] = mapped_column(Integer, nullable=False, default=36)
    term_step_months: Mapped[int] = mapped_column(Integer, nullable=False, default=6)  # шаг слайдера UI
    # Удорожание остатка в год; 0 = беспроцентная рассрочка
    markup_pct_annual: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False, default=0.0)
    price_per_m2: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)  # fallback-цена м²
    disclaimer: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=_now)


class SeoMeta(Base):
    """SEO-теги по слагу страницы (SEO2, управляется из админки).
    Шаблон суффикса title живёт на фронте (title.template) — поле title здесь
    задаёт точный заголовок вкладки целиком."""
    __tablename__ = "seo_meta"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)  # напр. "/", "/planirovki"
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    og_image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    # Исключить страницу из поисковой выдачи и sitemap
    noindex: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=_now)


class Redirect(Base):
    """301-редиректы. Создаются автоматически при смене слага (SEO-безопасность)
    и вручную из админки. from_path/to_path — пути без домена, напр. "/novosti/staryj"."""
    __tablename__ = "redirect"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    from_path: Mapped[str] = mapped_column(String(512), unique=True, nullable=False)
    to_path: Mapped[str] = mapped_column(String(512), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=_now)
