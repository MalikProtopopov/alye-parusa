"""Pydantic v2 схемы (вход/выход API)."""
import re
import uuid
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .sanitize import clean_html


def normalize_ru_phone(raw: str) -> Optional[str]:
    """Приводит телефон к каноническому виду +7XXXXXXXXXX (US-8.6).
    Возвращает None, если это не похоже на российский номер (10 цифр)."""
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 11 and digits[0] in ("7", "8"):
        digits = digits[1:]
    if len(digits) == 10:
        return "+7" + digits
    return None

# ─────────────────────────── Планировки ───────────────────────────

AvailabilityStatus = Literal["available", "reserved", "sold"]


class PlanCategoryBase(BaseModel):
    title: str
    slug: str
    description: Optional[str] = None  # вводный текст страницы категории (rich, санитизируется)
    active: bool = True
    sort: int = 0

    @field_validator("description")
    @classmethod
    def _sanitize_description(cls, v: Optional[str]) -> Optional[str]:
        return clean_html(v) if v else v


class PlanCategoryCreate(PlanCategoryBase):
    pass


class PlanCategoryUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    active: Optional[bool] = None
    sort: Optional[int] = None

    @field_validator("description")
    @classmethod
    def _sanitize_description(cls, v: Optional[str]) -> Optional[str]:
        return clean_html(v) if v else v


class PlanCategoryOut(PlanCategoryBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    updated_at: datetime
    # Кол-во планировок в категории (проставляется annotate-хуком в админ-роутах)
    floorplans_count: int = 0


class FloorplanBase(BaseModel):
    title: str
    slug: str
    category_id: Optional[uuid.UUID] = None
    description: Optional[str] = None  # rich-текст (WYSIWYG-lite), санитизируется
    area_m2: float
    price: Optional[float] = None
    availability_status: AvailabilityStatus = "available"
    floor: Optional[int] = None
    ceiling_height: Optional[float] = None
    image_url: Optional[str] = None
    active: bool = True
    sort: int = 0

    @field_validator("description")
    @classmethod
    def _sanitize_description(cls, v: Optional[str]) -> Optional[str]:
        return clean_html(v) if v else v


class FloorplanCreate(FloorplanBase):
    pass


class FloorplanUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    category_id: Optional[uuid.UUID] = None
    description: Optional[str] = None
    area_m2: Optional[float] = None
    price: Optional[float] = None
    availability_status: Optional[AvailabilityStatus] = None
    floor: Optional[int] = None
    ceiling_height: Optional[float] = None
    image_url: Optional[str] = None
    active: Optional[bool] = None
    sort: Optional[int] = None

    @field_validator("description")
    @classmethod
    def _sanitize_description(cls, v: Optional[str]) -> Optional[str]:
        return clean_html(v) if v else v


class FloorplanOut(FloorplanBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    category: Optional[PlanCategoryOut] = None
    created_at: datetime
    updated_at: datetime


# ─────────────────────────── Баннер ───────────────────────────


class BannerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    eyebrow: Optional[str] = None
    title: Optional[str] = None
    subtitle: Optional[str] = None
    cta_primary_label: Optional[str] = None
    cta_primary_target: Optional[str] = None
    cta_secondary_label: Optional[str] = None
    cta_secondary_target: Optional[str] = None
    background_url: Optional[str] = None


class BannerUpdate(BannerOut):
    pass


# ─────────────────────────── Контакты ───────────────────────────


class ContactsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    phone: Optional[str] = None
    email: Optional[str] = None
    telegram: Optional[str] = None
    whatsapp: Optional[str] = None
    address: Optional[str] = None
    work_hours: Optional[str] = None
    map_embed: Optional[str] = None
    inn: Optional[str] = None
    ogrn: Optional[str] = None
    cadastral_number: Optional[str] = None


class ContactsUpdate(ContactsOut):
    pass


# ─────────────────────────── Настройки ───────────────────────────


class SettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    show_prices: bool
    notify_channel: str
    metrika_id: Optional[str] = None
    yandex_verification: Optional[str] = None
    google_verification: Optional[str] = None
    # Настроен ли Telegram-бот на сервере (token+chat_id) — для честного hint в админке
    telegram_configured: bool = False


class SettingsUpdate(BaseModel):
    show_prices: Optional[bool] = None
    # email принимаем как легаси-значение, UI его не предлагает
    notify_channel: Optional[Literal["telegram", "none", "email"]] = None
    metrika_id: Optional[str] = None
    yandex_verification: Optional[str] = None
    google_verification: Optional[str] = None


# ─────────────────────────── Заявки ───────────────────────────

LeadKind = Literal["simple_callback", "with_calc", "without_calc", "presentation", "floorplan"]
LeadStatus = Literal["new", "in_progress", "done"]


class LeadCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    phone: str = Field(min_length=6, max_length=32)
    kind: LeadKind = "simple_callback"
    floorplan_id: Optional[uuid.UUID] = None
    message: Optional[str] = None
    consent_given: bool
    # Копия РЕДАКЦИИ текста согласия, показанного пользователю (152-ФЗ). Фронт
    # присылает ровно тот текст, под которым стоит галочка; при отсутствии — дефолт.
    consent_text: Optional[str] = Field(default=None, max_length=2000)
    utm: Optional[dict[str, Any]] = None
    source_button: Optional[str] = None
    source_block: Optional[str] = None
    page_url: Optional[str] = None
    calc_snapshot: Optional[dict[str, Any]] = None
    # honeypot (антиспам) — заполнено => бот
    website: Optional[str] = None

    @field_validator("source_button", "source_block", "page_url", "message")
    @classmethod
    def _truncate_to_columns(cls, v: Optional[str], info) -> Optional[str]:
        """Атрибуция обрезается под ширину колонок, а не отклоняется:
        заявка не должна теряться из-за длинного URL с UTM-хвостом."""
        if v is None:
            return v
        limits = {"source_button": 120, "source_block": 120, "page_url": 512, "message": 5000}
        return v[: limits[info.field_name]]

    @field_validator("consent_given")
    @classmethod
    def consent_required(cls, v: bool) -> bool:
        if v is not True:
            raise ValueError("consent_required")
        return v

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, v: str) -> str:
        norm = normalize_ru_phone(v)
        if norm is None:
            raise ValueError("invalid_phone")
        return norm


class LeadAccepted(BaseModel):
    id: uuid.UUID
    message: str = "Заявка принята, менеджер свяжется с вами"


class LeadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    phone: str
    kind: str
    floorplan_id: Optional[uuid.UUID] = None
    message: Optional[str] = None
    consent_given: bool
    consent_at: Optional[datetime] = None
    ip_address: Optional[str] = None
    utm: Optional[dict[str, Any]] = None
    source_button: Optional[str] = None
    source_block: Optional[str] = None
    page_url: Optional[str] = None
    calc_snapshot: Optional[dict[str, Any]] = None
    status: LeadStatus
    notes: Optional[str] = None
    created_at: datetime
    # Название планировки (из joined-relationship) — чтобы админка не показывала UUID
    floorplan_title: Optional[str] = None


class LeadPatch(BaseModel):
    status: Optional[LeadStatus] = None
    notes: Optional[str] = None


# ─────────────────────────── Auth ───────────────────────────


class LoginIn(BaseModel):
    email: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str


class MeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    email: str
    role: str


# ═══════════════════════ КОНТЕНТНЫЕ БЛОКИ ═══════════════════════
# Паттерн: Create (полный), Update (все Optional), Out (from_attributes).

_ORM = ConfigDict(from_attributes=True)


# ── Новости ──
# body — rich-текст из WYSIWYG: html санитизируется на сервере (см. sanitize.py)
class NewsBase(BaseModel):
    title: str
    slug: str
    excerpt: Optional[str] = None
    body: Optional[str] = None
    cover_image_url: Optional[str] = None
    published_at: Optional[datetime] = None
    active: bool = True
    sort: int = 0

    @field_validator("body")
    @classmethod
    def _sanitize_body(cls, v: Optional[str]) -> Optional[str]:
        return clean_html(v) if v else v

class NewsCreate(NewsBase): pass
class NewsUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    excerpt: Optional[str] = None
    body: Optional[str] = None
    cover_image_url: Optional[str] = None
    published_at: Optional[datetime] = None
    active: Optional[bool] = None
    sort: Optional[int] = None

    @field_validator("body")
    @classmethod
    def _sanitize_body(cls, v: Optional[str]) -> Optional[str]:
        return clean_html(v) if v else v
class NewsOut(NewsBase):
    model_config = _ORM
    id: uuid.UUID
    updated_at: datetime


# ── FAQ ──
# answer — rich-текст (WYSIWYG-lite): html санитизируется на сервере
class FaqBase(BaseModel):
    question: str
    answer: str
    active: bool = True
    sort: int = 0

    @field_validator("answer")
    @classmethod
    def _sanitize_answer(cls, v: str) -> str:
        return clean_html(v) if v else v

class FaqCreate(FaqBase): pass
class FaqUpdate(BaseModel):
    question: Optional[str] = None
    answer: Optional[str] = None
    active: Optional[bool] = None
    sort: Optional[int] = None

    @field_validator("answer")
    @classmethod
    def _sanitize_answer(cls, v: Optional[str]) -> Optional[str]:
        return clean_html(v) if v else v
class FaqOut(FaqBase):
    model_config = _ORM
    id: uuid.UUID


# ── Преимущества ──
# text — rich-текст (WYSIWYG-lite); category — группа карточек на главной
AdvantageCategory = Literal["living", "leisure", "infrastructure"]

class AdvantageBase(BaseModel):
    title: str
    text: Optional[str] = None
    image_url: Optional[str] = None
    category: Optional[AdvantageCategory] = None
    active: bool = True
    sort: int = 0

    @field_validator("text")
    @classmethod
    def _sanitize_text(cls, v: Optional[str]) -> Optional[str]:
        return clean_html(v) if v else v

class AdvantageCreate(AdvantageBase): pass
class AdvantageUpdate(BaseModel):
    title: Optional[str] = None
    text: Optional[str] = None
    image_url: Optional[str] = None
    category: Optional[AdvantageCategory] = None
    active: Optional[bool] = None
    sort: Optional[int] = None

    @field_validator("text")
    @classmethod
    def _sanitize_text(cls, v: Optional[str]) -> Optional[str]:
        return clean_html(v) if v else v
class AdvantageOut(AdvantageBase):
    model_config = _ORM
    id: uuid.UUID


# ── Партнёры ──
class PartnerBase(BaseModel):
    name: str
    logo_url: Optional[str] = None
    url: Optional[str] = None
    description: Optional[str] = None
    active: bool = True
    sort: int = 0
class PartnerCreate(PartnerBase): pass
class PartnerUpdate(BaseModel):
    name: Optional[str] = None
    logo_url: Optional[str] = None
    url: Optional[str] = None
    description: Optional[str] = None
    active: Optional[bool] = None
    sort: Optional[int] = None
class PartnerOut(PartnerBase):
    model_config = _ORM
    id: uuid.UUID


# ── Команда ──
class TeamMemberBase(BaseModel):
    name: str
    role: Optional[str] = None
    photo_url: Optional[str] = None
    bio: Optional[str] = None
    active: bool = True
    sort: int = 0
class TeamMemberCreate(TeamMemberBase): pass
class TeamMemberUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    photo_url: Optional[str] = None
    bio: Optional[str] = None
    active: Optional[bool] = None
    sort: Optional[int] = None
class TeamMemberOut(TeamMemberBase):
    model_config = _ORM
    id: uuid.UUID


# ── Документы ──
DocType = Literal["permit", "declaration", "policy", "link", "other"]

class DocumentBase(BaseModel):
    title: str
    slug: str
    doc_type: DocType = "other"
    description: Optional[str] = None  # аннотация для /dokumenty (rich, санитизируется)
    file_url: Optional[str] = None
    url: Optional[str] = None
    is_policy: bool = False
    active: bool = True
    sort: int = 0

    @field_validator("description")
    @classmethod
    def _sanitize_description(cls, v: Optional[str]) -> Optional[str]:
        return clean_html(v) if v else v

class DocumentCreate(DocumentBase): pass
class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    doc_type: Optional[DocType] = None
    description: Optional[str] = None
    file_url: Optional[str] = None
    url: Optional[str] = None
    is_policy: Optional[bool] = None
    active: Optional[bool] = None
    sort: Optional[int] = None

    @field_validator("description")
    @classmethod
    def _sanitize_description(cls, v: Optional[str]) -> Optional[str]:
        return clean_html(v) if v else v
class DocumentOut(DocumentBase):
    model_config = _ORM
    id: uuid.UUID
    updated_at: datetime


# ── Факты (ленты на главной) ──
FactGroup = Literal["about", "trust", "nearby", "investment"]

class FactBase(BaseModel):
    group: FactGroup
    label: str
    value: str
    note: Optional[str] = None
    active: bool = True
    sort: int = 0
class FactCreate(FactBase): pass
class FactUpdate(BaseModel):
    group: Optional[FactGroup] = None
    label: Optional[str] = None
    value: Optional[str] = None
    note: Optional[str] = None
    active: Optional[bool] = None
    sort: Optional[int] = None
class FactOut(FactBase):
    model_config = _ORM
    id: uuid.UUID


# ── Тексты секций ──
class SiteTextBase(BaseModel):
    key: str
    eyebrow: Optional[str] = None
    title: Optional[str] = None
    lead: Optional[str] = None
    active: bool = True
    sort: int = 0
class SiteTextCreate(SiteTextBase): pass
class SiteTextUpdate(BaseModel):
    key: Optional[str] = None
    eyebrow: Optional[str] = None
    title: Optional[str] = None
    lead: Optional[str] = None
    active: Optional[bool] = None
    sort: Optional[int] = None
class SiteTextOut(SiteTextBase):
    model_config = _ORM
    id: uuid.UUID


# ── Главы скролл-hero ──
class HeroChapterBase(BaseModel):
    eyebrow: Optional[str] = None
    title: str
    subtitle: Optional[str] = None
    active: bool = True
    sort: int = 0
class HeroChapterCreate(HeroChapterBase): pass
class HeroChapterUpdate(BaseModel):
    eyebrow: Optional[str] = None
    title: Optional[str] = None
    subtitle: Optional[str] = None
    active: Optional[bool] = None
    sort: Optional[int] = None
class HeroChapterOut(HeroChapterBase):
    model_config = _ORM
    id: uuid.UUID


# ═══════════════════════ КАЛЬКУЛЯТОР РАССРОЧКИ (X1) ═══════════════════════
# Все проценты — доли 0..1 (0.30 = 30 %).

class CalculatorParamsOut(BaseModel):
    model_config = _ORM
    min_down_payment_pct: float
    max_down_payment_pct: float
    term_min_months: int
    term_max_months: int
    term_step_months: int
    markup_pct_annual: float
    price_per_m2: Optional[float] = None
    disclaimer: Optional[str] = None

class CalculatorParamsUpdate(BaseModel):
    min_down_payment_pct: Optional[float] = Field(default=None, ge=0, le=1)
    max_down_payment_pct: Optional[float] = Field(default=None, ge=0, le=1)
    term_min_months: Optional[int] = Field(default=None, ge=1)
    term_max_months: Optional[int] = Field(default=None, ge=1)
    term_step_months: Optional[int] = Field(default=None, ge=1)
    markup_pct_annual: Optional[float] = Field(default=None, ge=0)
    price_per_m2: Optional[float] = Field(default=None, ge=0)
    disclaimer: Optional[str] = None

    @model_validator(mode="after")
    def _ranges(self) -> "CalculatorParamsUpdate":
        if (
            self.min_down_payment_pct is not None
            and self.max_down_payment_pct is not None
            and self.min_down_payment_pct > self.max_down_payment_pct
        ):
            raise ValueError("min_down_payment_gt_max")
        if (
            self.term_min_months is not None
            and self.term_max_months is not None
            and self.term_min_months > self.term_max_months
        ):
            raise ValueError("term_min_gt_max")
        return self

class CalcRequest(BaseModel):
    mode: Literal["floorplan", "amount"] = "amount"
    floorplan_id: Optional[uuid.UUID] = None
    amount: Optional[float] = Field(default=None, ge=0)
    down_payment_pct: Optional[float] = Field(default=None, ge=0, le=1)  # None → минимум из params
    months: Optional[int] = Field(default=None, ge=1)                    # None → максимум из params

class CalcResult(BaseModel):
    price: float
    down_payment_pct: float
    down_payment: float
    financed: float
    months: int
    markup_pct_annual: float
    markup: float
    monthly_payment: float
    total_cost: float
    disclaimer: str


# ═══════════════════════ SEO (SEO2) ═══════════════════════

class SeoMetaBase(BaseModel):
    slug: str
    title: Optional[str] = None
    description: Optional[str] = None
    og_image_url: Optional[str] = None
    noindex: bool = False
class SeoMetaCreate(SeoMetaBase): pass
class SeoMetaUpdate(BaseModel):
    slug: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    og_image_url: Optional[str] = None
    noindex: Optional[bool] = None
class SeoMetaOut(SeoMetaBase):
    model_config = _ORM
    id: uuid.UUID
    updated_at: datetime


# ═══════════════════════ Редиректы (301) ═══════════════════════


def _normalize_redirect_path(v: str) -> str:
    """Путь без домена: с ведущим «/», без query/fragment и хвостового слэша."""
    v = (v or "").strip()
    if not v.startswith("/"):
        raise ValueError("path_must_start_with_slash")
    v = v.split("?", 1)[0].split("#", 1)[0]
    return v.rstrip("/") or "/"


class RedirectBase(BaseModel):
    from_path: str
    to_path: str
    active: bool = True
    note: Optional[str] = None

    @field_validator("from_path", "to_path")
    @classmethod
    def _normalize(cls, v: str) -> str:
        return _normalize_redirect_path(v)

    @model_validator(mode="after")
    def _no_self_redirect(self) -> "RedirectBase":
        if self.from_path == self.to_path:
            raise ValueError("redirect_to_self")
        return self


class RedirectCreate(RedirectBase):
    pass


class RedirectUpdate(BaseModel):
    from_path: Optional[str] = None
    to_path: Optional[str] = None
    active: Optional[bool] = None
    note: Optional[str] = None

    @field_validator("from_path", "to_path")
    @classmethod
    def _normalize(cls, v: Optional[str]) -> Optional[str]:
        return _normalize_redirect_path(v) if v is not None else v


class RedirectOut(RedirectBase):
    model_config = _ORM
    id: uuid.UUID
    updated_at: datetime


class RedirectResolveOut(BaseModel):
    from_path: str
    to_path: str


# ═══════════════════════ Сортировка (drag-n-drop) ═══════════════════════


class ReorderItem(BaseModel):
    id: uuid.UUID
    sort: int


# ═══════════════════════ Фичефлаги ═══════════════════════

class FeaturesOut(BaseModel):
    news: bool
    faq: bool
    advantages: bool
    partners: bool
    team: bool
    documents: bool
    calculator: bool
    seo_admin: bool
