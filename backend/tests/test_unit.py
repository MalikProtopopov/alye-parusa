"""Юнит-тесты чистой логики: валидация схем, безопасность, RBAC — без БД."""
import types

import jwt
import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.config import settings
from app.schemas import LeadCreate, normalize_ru_phone
from app.security import (
    create_access_token, hash_password, require_role, verify_password,
)


# ─────────── Нормализация телефона (US-8.6) ───────────

def test_normalize_ru_phone_canonical():
    assert normalize_ru_phone("+7 900 123-45-67") == "+79001234567"
    assert normalize_ru_phone("8 (900) 123-45-67") == "+79001234567"
    assert normalize_ru_phone("89001234567") == "+79001234567"
    assert normalize_ru_phone("+79001234567") == "+79001234567"
    assert normalize_ru_phone("9001234567") == "+79001234567"


def test_normalize_ru_phone_invalid():
    for bad in ["", "123", "12345", "abcdef", "+7 900 12"]:
        assert normalize_ru_phone(bad) is None


def test_leadcreate_normalizes_phone():
    lead = LeadCreate(name="Иван", phone="8 (900) 123-45-67", consent_given=True)
    assert lead.phone == "+79001234567"


# ─────────── Валидация заявки (152-ФЗ + телефон) ───────────

def _lead_kwargs(**over):
    base = dict(name="Иван", phone="+7 900 123-45-67", consent_given=True)
    base.update(over)
    return base


def test_consent_required_true():
    with pytest.raises(ValidationError):
        LeadCreate(**_lead_kwargs(consent_given=False))


def test_consent_true_ok():
    lead = LeadCreate(**_lead_kwargs())
    assert lead.consent_given is True


def test_phone_too_short_rejected():
    with pytest.raises(ValidationError):
        LeadCreate(**_lead_kwargs(phone="12345"))


def test_phone_valid_various_formats():
    for p in ["+7 900 123-45-67", "89001234567", "+79001234567"]:
        assert LeadCreate(**_lead_kwargs(phone=p)).phone


def test_name_min_length():
    with pytest.raises(ValidationError):
        LeadCreate(**_lead_kwargs(name="A"))


def test_default_kind_is_simple_callback():
    assert LeadCreate(**_lead_kwargs()).kind == "simple_callback"


def test_invalid_kind_rejected():
    with pytest.raises(ValidationError):
        LeadCreate(**_lead_kwargs(kind="totally_unknown"))


# ─────────── Безопасность: хэш и JWT ───────────

def test_password_hash_and_verify():
    h = hash_password("secret123")
    assert h != "secret123"
    assert verify_password("secret123", h) is True
    assert verify_password("wrong", h) is False


def test_access_token_roundtrip():
    token = create_access_token(sub="abc-123", role="admin")
    payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    assert payload["sub"] == "abc-123"
    assert payload["role"] == "admin"
    assert "exp" in payload


# ─────────── RBAC (З12) ───────────

def _user(role):
    return types.SimpleNamespace(role=role, is_active=True)


def test_admin_passes_admin_only():
    dep = require_role("admin")
    u = _user("admin")
    assert dep(user=u) is u


def test_admin_passes_staff():
    dep = require_role("admin", "manager")
    u = _user("admin")
    assert dep(user=u) is u


def test_manager_passes_staff():
    dep = require_role("admin", "manager")
    u = _user("manager")
    assert dep(user=u) is u


def test_manager_denied_admin_only():
    dep = require_role("admin")
    with pytest.raises(HTTPException) as exc:
        dep(user=_user("manager"))
    assert exc.value.status_code == 403


def test_unknown_role_denied():
    dep = require_role("admin", "manager")
    with pytest.raises(HTTPException) as exc:
        dep(user=_user("guest"))
    assert exc.value.status_code == 403


# ─────────── Слаги (app/slug.py) ───────────

from app.slug import slugify  # noqa: E402


def test_slugify_translit():
    assert slugify("Проектная декларация") == "proektnaya-deklaraciya"
    assert slugify("Политика конфиденциальности") == "politika-konfidencialnosti"


def test_slugify_mixed_and_symbols():
    assert slugify("Наш.дом.рф — карточка объекта") == "nash-dom-rf-kartochka-obekta"
    assert slugify("  Разрешение №5 (2026)  ") == "razreshenie-5-2026"


def test_slugify_empty_fallback():
    assert slugify("") == "doc"
    assert slugify("!!!") == "doc"
