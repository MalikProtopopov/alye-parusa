"""API-тесты админки: auth, RBAC (З12), CRUD планировок, singleton-настройки, заявки."""
import uuid


# ─────────── Auth ───────────

def test_login_admin_role(client):
    r = client.post("/api/v1/admin/auth/login", json={"email": "admin@alyeparusa.local", "password": "admin12345"})
    assert r.status_code == 200
    assert r.json()["role"] == "admin"
    assert r.json()["access_token"]


def test_login_manager_role(client):
    r = client.post("/api/v1/admin/auth/login", json={"email": "manager@alyeparusa.local", "password": "manager12345"})
    assert r.status_code == 200
    assert r.json()["role"] == "manager"


def test_login_wrong_password_401(client):
    r = client.post("/api/v1/admin/auth/login", json={"email": "admin@alyeparusa.local", "password": "nope"})
    assert r.status_code == 401


def test_me_requires_token(client):
    assert client.get("/api/v1/admin/auth/me").status_code == 401


def test_me_returns_user(client, admin_token, bearer):
    r = client.get("/api/v1/admin/auth/me", headers=bearer(admin_token))
    assert r.status_code == 200
    assert r.json()["email"] == "admin@alyeparusa.local"
    assert r.json()["role"] == "admin"


def test_bad_token_401(client, bearer):
    assert client.get("/api/v1/admin/auth/me", headers=bearer("garbage.token.value")).status_code == 401


# ─────────── RBAC ───────────

def test_manager_forbidden_on_content(client, manager_token, bearer):
    assert client.get("/api/v1/admin/floorplans", headers=bearer(manager_token)).status_code == 403
    assert client.get("/api/v1/admin/settings", headers=bearer(manager_token)).status_code == 403
    assert client.get("/api/v1/admin/banner", headers=bearer(manager_token)).status_code == 403


def test_manager_allowed_on_leads(client, manager_token, bearer):
    assert client.get("/api/v1/admin/leads", headers=bearer(manager_token)).status_code == 200


def test_admin_allowed_on_content(client, admin_token, bearer):
    assert client.get("/api/v1/admin/floorplans", headers=bearer(admin_token)).status_code == 200


def test_content_requires_auth(client):
    assert client.get("/api/v1/admin/floorplans").status_code == 401


# ─────────── CRUD планировок ───────────

def _new_fp(**over):
    base = dict(
        title="Тестовая планировка", slug=f"test-{uuid.uuid4().hex[:8]}",
        area_m2=30.0, price=6000000,
        availability_status="available", sort=999,
    )
    base.update(over)
    return base


def test_floorplan_crud_lifecycle(client, admin_token, bearer):
    h = bearer(admin_token)
    payload = _new_fp()

    # create
    r = client.post("/api/v1/admin/floorplans", headers=h, json=payload)
    assert r.status_code == 201, r.text
    fid = r.json()["id"]

    # read
    assert client.get(f"/api/v1/admin/floorplans/{fid}", headers=h).status_code == 200

    # публично видна по слагу
    assert client.get(f"/api/v1/floorplans/{payload['slug']}").status_code == 200

    # update
    r = client.put(f"/api/v1/admin/floorplans/{fid}", headers=h, json={"title": "Обновлено", "price": 6500000})
    assert r.status_code == 200
    assert r.json()["title"] == "Обновлено"
    assert float(r.json()["price"]) == 6500000

    # delete
    assert client.delete(f"/api/v1/admin/floorplans/{fid}", headers=h).status_code == 204
    assert client.get(f"/api/v1/admin/floorplans/{fid}", headers=h).status_code == 404


def test_floorplan_duplicate_slug_409(client, admin_token, bearer):
    h = bearer(admin_token)
    r = client.post("/api/v1/admin/floorplans", headers=h, json=_new_fp(slug="studiya-2682"))
    assert r.status_code == 409


def test_floorplan_category_assignment(client, admin_token, bearer):
    """category_id назначается и снимается; в ответе — вложенная категория."""
    h = bearer(admin_token)
    cat = next(c for c in client.get("/api/v1/plan-categories").json() if c["slug"] == "studii")
    r = client.post("/api/v1/admin/floorplans", headers=h, json=_new_fp(category_id=cat["id"]))
    assert r.status_code == 201, r.text
    fid = r.json()["id"]
    try:
        assert r.json()["category"]["slug"] == "studii"
        r = client.put(f"/api/v1/admin/floorplans/{fid}", headers=h, json={"category_id": None})
        assert r.status_code == 200
        assert r.json()["category"] is None
    finally:
        client.delete(f"/api/v1/admin/floorplans/{fid}", headers=h)


def test_inactive_floorplan_hidden_publicly(client, admin_token, bearer):
    h = bearer(admin_token)
    payload = _new_fp(active=False)
    r = client.post("/api/v1/admin/floorplans", headers=h, json=payload)
    fid = r.json()["id"]
    try:
        # в публичном списке отсутствует
        assert payload["slug"] not in {f["slug"] for f in client.get("/api/v1/floorplans").json()}
        # и по слагу 404 (только активные)
        assert client.get(f"/api/v1/floorplans/{payload['slug']}").status_code == 404
    finally:
        client.delete(f"/api/v1/admin/floorplans/{fid}", headers=h)


# ─────────── Singletons: баннер / контакты / настройки ───────────

def test_banner_update_persists(client, admin_token, bearer):
    h = bearer(admin_token)
    r = client.put("/api/v1/admin/banner", headers=h, json={"title": "Новый заголовок"})
    assert r.status_code == 200
    assert client.get("/api/v1/banner").json()["title"] == "Новый заголовок"


def test_contacts_update_persists(client, admin_token, bearer):
    h = bearer(admin_token)
    r = client.put("/api/v1/admin/contacts", headers=h, json={"phone": "+7 999 111-22-33"})
    assert r.status_code == 200
    assert client.get("/api/v1/contacts").json()["phone"] == "+7 999 111-22-33"


def test_settings_update_persists(client, admin_token, bearer):
    h = bearer(admin_token)
    r = client.put("/api/v1/admin/settings", headers=h, json={"notify_channel": "email"})
    assert r.status_code == 200
    assert client.get("/api/v1/admin/settings", headers=h).json()["notify_channel"] == "email"
    client.put("/api/v1/admin/settings", headers=h, json={"notify_channel": "telegram"})


# ─────────── Заявки: смена статуса / заметки ───────────

def test_lead_patch_status_and_notes(client, admin_token, manager_token, bearer):
    # создаём заявку
    r = client.post("/api/v1/leads", json={"name": "Патч Тест", "phone": "+7 900 000-00-00", "consent_given": True})
    lead_id = r.json()["id"]
    # менеджер меняет статус и заметку
    r = client.patch(f"/api/v1/admin/leads/{lead_id}", headers=bearer(manager_token),
                     json={"status": "in_progress", "notes": "Перезвонить завтра"})
    assert r.status_code == 200
    assert r.json()["status"] == "in_progress"
    assert r.json()["notes"] == "Перезвонить завтра"


def test_lead_patch_unknown_404(client, admin_token, bearer):
    r = client.patch(f"/api/v1/admin/leads/{uuid.uuid4()}", headers=bearer(admin_token), json={"status": "done"})
    assert r.status_code == 404


def test_leads_status_filter(client, admin_token, bearer):
    h = bearer(admin_token)
    # создаём и закрываем одну заявку
    lid = client.post("/api/v1/leads", json={"name": "Фильтр", "phone": "+7 900 555-55-55", "consent_given": True}).json()["id"]
    client.patch(f"/api/v1/admin/leads/{lid}", headers=h, json={"status": "done"})
    done = client.get("/api/v1/admin/leads?status=done", headers=h).json()
    assert all(l["status"] == "done" for l in done)
    assert lid in {l["id"] for l in done}


def test_get_lead_by_id(client, admin_token, bearer):
    h = bearer(admin_token)
    lid = client.post("/api/v1/leads", json={"name": "Карточка", "phone": "+7 900 222-33-44", "consent_given": True}).json()["id"]
    r = client.get(f"/api/v1/admin/leads/{lid}", headers=h)
    assert r.status_code == 200
    assert r.json()["id"] == lid
    assert client.get(f"/api/v1/admin/leads/{uuid.uuid4()}", headers=h).status_code == 404


def test_delete_lead_admin_only(client, admin_token, manager_token, bearer):
    """152-ФЗ право на удаление ПДн — только Суперадмин."""
    lid = client.post("/api/v1/leads", json={"name": "Удалить ПДн", "phone": "+7 900 333-44-55", "consent_given": True}).json()["id"]
    # менеджеру нельзя
    assert client.delete(f"/api/v1/admin/leads/{lid}", headers=bearer(manager_token)).status_code == 403
    # суперадмин удаляет
    assert client.delete(f"/api/v1/admin/leads/{lid}", headers=bearer(admin_token)).status_code == 204
    assert client.get(f"/api/v1/admin/leads/{lid}", headers=bearer(admin_token)).status_code == 404


def test_export_leads_csv(client, admin_token, manager_token, bearer):
    client.post("/api/v1/leads", json={"name": "Экспорт Тест", "phone": "+7 900 444-55-66", "consent_given": True})
    r = client.get("/api/v1/admin/leads/export", headers=bearer(admin_token))
    assert r.status_code == 200
    assert "text/csv" in r.headers["content-type"]
    assert "attachment" in r.headers.get("content-disposition", "")
    body = r.content.decode("utf-8")
    assert "Имя" in body and "Телефон" in body  # заголовки
    assert "Экспорт Тест" in body
    # менеджеру экспорт тоже доступен (это его зона — заявки)
    assert client.get("/api/v1/admin/leads/export", headers=bearer(manager_token)).status_code == 200
