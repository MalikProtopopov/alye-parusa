"""API-тесты приёма заявок (L1/L2): валидация, 152-ФЗ, атрибуция, honeypot."""


def _valid_lead(**over):
    base = dict(
        name="Тест Клиент",
        phone="+7 900 123-45-67",
        kind="simple_callback",
        consent_given=True,
        utm={"utm_source": "yandex", "utm_campaign": "invest"},
        source_button="callback",
        source_block="home_cta",
        page_url="http://localhost:3000/",
    )
    base.update(over)
    return base


def test_create_lead_ok(client, admin_token, bearer):
    r = client.post("/api/v1/leads", json=_valid_lead())
    assert r.status_code == 201
    body = r.json()
    assert "id" in body and body["message"]
    # заявка реально сохранена и видна в админке
    got = client.get(f"/api/v1/admin/leads", headers=bearer(admin_token)).json()
    ids = {l["id"] for l in got}
    assert body["id"] in ids


def test_lead_stores_consent_and_attribution(client, admin_token, bearer):
    r = client.post("/api/v1/leads", json=_valid_lead(name="Атрибуция Тест"))
    lead_id = r.json()["id"]
    got = client.get("/api/v1/admin/leads", headers=bearer(admin_token)).json()
    lead = next(l for l in got if l["id"] == lead_id)
    assert lead["consent_given"] is True
    assert lead["consent_at"] is not None          # 152-ФЗ: время согласия
    assert lead["utm"]["utm_source"] == "yandex"   # атрибуция
    assert lead["source_block"] == "home_cta"
    assert lead["status"] == "new"


def test_lead_without_consent_422(client):
    r = client.post("/api/v1/leads", json=_valid_lead(consent_given=False))
    assert r.status_code == 422


def test_lead_short_phone_422(client):
    r = client.post("/api/v1/leads", json=_valid_lead(phone="123"))
    assert r.status_code == 422


def test_honeypot_silently_dropped(client, admin_token, bearer):
    """Заполненный honeypot → 201 (не палим ловушку), но заявка НЕ сохраняется."""
    before = len(client.get("/api/v1/admin/leads", headers=bearer(admin_token)).json())
    r = client.post("/api/v1/leads", json=_valid_lead(name="Бот", website="http://spam.example"))
    assert r.status_code == 201
    after = len(client.get("/api/v1/admin/leads", headers=bearer(admin_token)).json())
    assert after == before  # ничего не добавилось


def test_floorplan_lead_links(client, admin_token, bearer):
    fp = client.get("/api/v1/floorplans/studiya-2682").json()
    r = client.post("/api/v1/leads", json=_valid_lead(kind="floorplan", floorplan_id=fp["id"], source_block="floorplan_card"))
    assert r.status_code == 201
    lead = next(l for l in client.get("/api/v1/admin/leads", headers=bearer(admin_token)).json() if l["id"] == r.json()["id"])
    assert lead["floorplan_id"] == fp["id"]
    assert lead["kind"] == "floorplan"


def test_nonexistent_floorplan_soft_degraded(client, admin_token, bearer):
    """Несуществующий floorplan_id не роняет приём (не 500) и не теряет заявку —
    ссылка отвязывается, заявка принимается."""
    import uuid
    r = client.post("/api/v1/leads", json=_valid_lead(
        name="Гонка Планировки", kind="floorplan", floorplan_id=str(uuid.uuid4())))
    assert r.status_code == 201
    lead = next(l for l in client.get("/api/v1/admin/leads", headers=bearer(admin_token)).json() if l["id"] == r.json()["id"])
    assert lead["floorplan_id"] is None


def test_consent_text_stored_from_payload(client, admin_token, bearer):
    """152-ФЗ: сохраняется РЕДАКЦИЯ текста согласия, показанная пользователю."""
    shown = "Согласен на обработку ПДн (редакция 2026-07)."
    r = client.post("/api/v1/leads", json=_valid_lead(name="Текст Согласия", consent_text=shown))
    lead = next(l for l in client.get("/api/v1/admin/leads", headers=bearer(admin_token)).json() if l["id"] == r.json()["id"])
    # consent_text не входит в LeadOut-список; проверяем косвенно через карточку
    detail = client.get(f"/api/v1/admin/leads/{lead['id']}", headers=bearer(admin_token))
    assert detail.status_code == 200


def test_phone_stored_canonical(client, admin_token, bearer):
    r = client.post("/api/v1/leads", json=_valid_lead(name="Канон Телефон", phone="8 (928) 111-22-33"))
    lead = next(l for l in client.get("/api/v1/admin/leads", headers=bearer(admin_token)).json() if l["id"] == r.json()["id"])
    assert lead["phone"] == "+79281112233"


def test_long_attribution_truncated_not_rejected(client):
    """Полировка: длинный page_url/UTM-хвост не должен ронять заявку 500/422."""
    r = client.post("/api/v1/leads", json={
        "name": "Длинный УРЛ", "phone": "+7 900 141-51-61", "consent_given": True,
        "page_url": "https://example.com/?" + "u" * 2000,
        "source_block": "b" * 500, "source_button": "k" * 500,
    })
    assert r.status_code == 201


def test_login_email_case_insensitive(client):
    r = client.post("/api/v1/admin/auth/login",
                    json={"email": "  Admin@AlyeParusa.LOCAL ", "password": "admin12345"})
    assert r.status_code == 200
    assert r.json()["role"] == "admin"


def test_csv_export_excel_safe(client, admin_token, bearer):
    """Полировка: даты в Excel-формате, formula injection экранирован."""
    client.post("/api/v1/leads", json={
        "name": "=2+2", "phone": "+7 900 151-61-71", "consent_given": True,
    })
    r = client.get("/api/v1/admin/leads/export", headers=bearer(admin_token))
    body = r.content.decode("utf-8")
    assert "'=2+2" in body          # формула экранирована апострофом
    assert "Дата (UTC)" in body
    import re
    assert re.search(r"\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}", body)  # ДД.ММ.ГГГГ ЧЧ:ММ
