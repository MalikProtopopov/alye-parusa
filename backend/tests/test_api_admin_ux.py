"""UX-волна админки: policy-guard, reorder, счётчики, health, notify, медиа-защита."""
import uuid

import app.notify as notify_mod


# ─────────── Политика конфиденциальности (152-ФЗ) ───────────

def _mk_doc(client, h, **over):
    base = {"title": f"Док {uuid.uuid4().hex[:6]}", "slug": f"doc-{uuid.uuid4().hex[:8]}",
            "doc_type": "other"}
    base.update(over)
    r = client.post("/api/v1/admin/documents", headers=h, json=base)
    assert r.status_code == 201, r.text
    return r.json()


def test_policy_uncheck_only_active_blocked(client, admin_token, bearer):
    h = bearer(admin_token)
    policy = next(d for d in client.get("/api/v1/admin/documents", headers=h).json() if d["is_policy"])
    # снять пометку с единственной активной политики нельзя
    assert client.put(f"/api/v1/admin/documents/{policy['id']}", headers=h,
                      json={"is_policy": False}).status_code == 409
    # деактивировать — тоже
    assert client.put(f"/api/v1/admin/documents/{policy['id']}", headers=h,
                      json={"active": False}).status_code == 409
    # удалить — тоже
    assert client.delete(f"/api/v1/admin/documents/{policy['id']}", headers=h).status_code == 409


def test_policy_transfer_on_set(client, admin_token, bearer):
    """Установка is_policy на другом документе переносит пометку."""
    h = bearer(admin_token)
    old = next(d for d in client.get("/api/v1/admin/documents", headers=h).json() if d["is_policy"])
    new = _mk_doc(client, h, title="Новая политика", is_policy=True)
    try:
        assert new["is_policy"] is True
        docs = client.get("/api/v1/admin/documents", headers=h).json()
        assert sum(1 for d in docs if d["is_policy"]) == 1
        assert not next(d for d in docs if d["id"] == old["id"])["is_policy"]
    finally:
        # вернуть пометку исходному и удалить временный
        client.put(f"/api/v1/admin/documents/{old['id']}", headers=h, json={"is_policy": True})
        client.delete(f"/api/v1/admin/documents/{new['id']}", headers=h)


# ─────────── Reorder (drag-n-drop) ───────────

def test_generic_reorder(client, admin_token, bearer):
    h = bearer(admin_token)
    faq = client.get("/api/v1/admin/faq", headers=h).json()
    assert len(faq) >= 2
    items = [{"id": f["id"], "sort": (len(faq) - i) * 10} for i, f in enumerate(faq)]
    assert client.post("/api/v1/admin/faq/reorder", headers=h, json=items).status_code == 204
    after = client.get("/api/v1/admin/faq", headers=h).json()
    assert after[0]["id"] == faq[-1]["id"]  # последний стал первым
    # вернуть порядок
    restore = [{"id": f["id"], "sort": f["sort"]} for f in faq]
    client.post("/api/v1/admin/faq/reorder", headers=h, json=restore)


def test_floorplans_reorder(client, admin_token, bearer):
    h = bearer(admin_token)
    fps = client.get("/api/v1/admin/floorplans", headers=h).json()
    first = fps[0]
    assert client.post("/api/v1/admin/floorplans/reorder", headers=h,
                       json=[{"id": first["id"], "sort": 9999}]).status_code == 204
    after = client.get("/api/v1/admin/floorplans", headers=h).json()
    assert after[-1]["id"] == first["id"]
    client.post("/api/v1/admin/floorplans/reorder", headers=h,
                json=[{"id": first["id"], "sort": first["sort"]}])


# ─────────── Счётчики и карточки ───────────

def test_plan_categories_floorplans_count(client, admin_token, bearer):
    h = bearer(admin_token)
    cats = client.get("/api/v1/admin/plan-categories", headers=h).json()
    studii = next(c for c in cats if c["slug"] == "studii")
    assert studii["floorplans_count"] >= 5  # сидировано 6 студий


def test_leads_count_and_floorplan_title(client, admin_token, bearer):
    h = bearer(admin_token)
    fp = client.get("/api/v1/floorplans/studiya-2682").json()
    client.post("/api/v1/leads", json={
        "name": "Каунт Тест", "phone": "+7 900 111-22-33",
        "kind": "floorplan", "floorplan_id": fp["id"], "consent_given": True,
    })
    r = client.get("/api/v1/admin/leads/count", headers=h, params={"status": "new"})
    assert r.status_code == 200 and r.json()["count"] >= 1
    leads = client.get("/api/v1/admin/leads", headers=h).json()
    lead = next(l for l in leads if l["name"] == "Каунт Тест")
    assert lead["floorplan_title"] == fp["title"]


# ─────────── Здоровье контента ───────────

def test_content_health(client, admin_token, manager_token, bearer):
    h = bearer(admin_token)
    r = client.get("/api/v1/admin/health", headers=h)
    assert r.status_code == 200
    checks = {c["id"]: c for c in r.json()["checks"]}
    assert checks["policy_active"]["status"] == "ok"
    assert checks["hero_chapters"]["status"] == "ok"  # сидировано ровно 6
    assert "seo_orphans" in checks
    # менеджеру панель не положена (контентная зона)
    assert client.get("/api/v1/admin/health", headers=bearer(manager_token)).status_code == 403


# ─────────── Уведомления ───────────

def test_lead_triggers_telegram(client, monkeypatch):
    sent: list[str] = []
    monkeypatch.setattr(notify_mod, "send_telegram", lambda text: sent.append(text) or True)
    r = client.post("/api/v1/leads", json={
        "name": "Нотиф Тест", "phone": "+7 900 555-66-77", "consent_given": True,
        "source_block": "cta",
    })
    assert r.status_code == 201
    assert len(sent) == 1
    assert "Нотиф Тест" in sent[0] and "tel:+79005556677" in sent[0]


def test_test_notification_unconfigured(client, admin_token, bearer):
    # без токена — честная 400
    r = client.post("/api/v1/admin/settings/test-notification", headers=bearer(admin_token))
    assert r.status_code == 400
    assert r.json()["detail"] == "telegram_not_configured"


def test_settings_new_fields_roundtrip(client, admin_token, bearer):
    h = bearer(admin_token)
    r = client.put("/api/v1/admin/settings", headers=h, json={
        "yandex_verification": "ya-123", "google_verification": "goo-456",
        "notify_channel": "none",
    })
    assert r.status_code == 200
    d = r.json()
    assert d["yandex_verification"] == "ya-123" and d["google_verification"] == "goo-456"
    assert d["notify_channel"] == "none"
    assert d["telegram_configured"] is False
    # публичный /analytics отдаёт верификацию
    pub = client.get("/api/v1/analytics").json()
    assert pub["yandex_verification"] == "ya-123"
    client.put("/api/v1/admin/settings", headers=h, json={
        "yandex_verification": None, "google_verification": None, "notify_channel": "telegram",
    })


# ─────────── Медиа: защита от удаления используемого файла ───────────

def test_media_delete_in_use_blocked(client, admin_token, bearer):
    h = bearer(admin_token)
    import io

    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (900, 600), "red").save(buf, format="PNG")
    buf.seek(0)
    up = client.post("/api/v1/admin/media", headers=h,
                     files={"file": ("test-used.png", buf, "image/png")})
    assert up.status_code == 201, up.text
    name = up.json()["url"].rsplit("/", 1)[-1]
    fp = client.post("/api/v1/admin/floorplans", headers=h, json={
        "title": "Медиа Тест", "slug": f"media-{uuid.uuid4().hex[:8]}",
        "area_m2": 30, "image_url": up.json()["url"],
    }).json()
    try:
        r = client.delete(f"/api/v1/admin/media/{name}", headers=h)
        assert r.status_code == 409
        detail = r.json()["detail"]
        assert detail["code"] == "media_in_use"
        assert any(u["type"] == "floorplan" for u in detail["used_by"])
    finally:
        client.delete(f"/api/v1/admin/floorplans/{fp['id']}", headers=h)
        client.delete(f"/api/v1/admin/media/{name}", headers=h)


# ─────────── SEO: noindex + known-paths ───────────

def test_seo_noindex_and_known_paths(client, admin_token, bearer):
    h = bearer(admin_token)
    r = client.post("/api/v1/admin/seo", headers=h,
                    json={"slug": "/dokumenty", "title": "x"})
    # /dokumenty уже засиден → 409; тогда обновим существующий
    if r.status_code == 409:
        row = next(s for s in client.get("/api/v1/admin/seo", headers=h).json() if s["slug"] == "/dokumenty")
        sid = row["id"]
    else:
        sid = r.json()["id"]
    assert client.put(f"/api/v1/admin/seo/{sid}", headers=h, json={"noindex": True}).status_code == 200
    assert "/dokumenty" in client.get("/api/v1/seo/noindex").json()
    known = client.get("/api/v1/admin/seo-known-paths", headers=h).json()
    by_path = {k["path"]: k for k in known}
    assert by_path["/"]["kind"] == "static" and by_path["/"]["has_seo"] is True
    assert by_path["/planirovki/studii"]["kind"] == "plan_category"
    assert any(k["kind"] == "news" for k in known)
    # вернуть noindex
    client.put(f"/api/v1/admin/seo/{sid}", headers=h, json={"noindex": False})


def test_policy_cannot_move_to_inactive_doc(client, admin_token, bearer):
    """Регресс: is_policy=true не должен обходить guard активности (152-ФЗ)."""
    h = bearer(admin_token)
    policy = next(d for d in client.get("/api/v1/admin/documents", headers=h).json() if d["is_policy"])
    assert client.put(f"/api/v1/admin/documents/{policy['id']}", headers=h,
                      json={"is_policy": True, "active": False}).status_code == 409
    assert client.post("/api/v1/admin/documents", headers=h, json={
        "title": "Черновик политики", "slug": f"draft-pol-{uuid.uuid4().hex[:6]}",
        "is_policy": True, "active": False}).status_code == 409
    inactive = client.post("/api/v1/admin/documents", headers=h, json={
        "title": "Просто документ", "slug": f"plain-{uuid.uuid4().hex[:6]}", "active": False}).json()
    try:
        assert client.put(f"/api/v1/admin/documents/{inactive['id']}", headers=h,
                          json={"is_policy": True}).status_code == 409
    finally:
        client.delete(f"/api/v1/admin/documents/{inactive['id']}", headers=h)
    assert client.get("/api/v1/policy-document").status_code == 200


def test_notify_escapes_html(client, monkeypatch):
    """Регресс: «<» в имени/источнике не ломает parse_mode=HTML и не внедряет разметку."""
    sent: list[str] = []
    monkeypatch.setattr(notify_mod, "send_telegram", lambda text: sent.append(text) or True)
    r = client.post("/api/v1/leads", json={
        "name": "Компания <ООО> & Ко", "phone": "+7 900 321-00-99", "consent_given": True,
        "source_block": "<script>x</script>",
        "calc_snapshot": {"input": {}, "result": "не словарь"},
    })
    assert r.status_code == 201
    assert len(sent) == 1
    assert "<ООО>" not in sent[0] and "&lt;ООО&gt;" in sent[0]
    assert "<script>" not in sent[0]
