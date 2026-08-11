"""API-тесты новых блоков: контент-CRUD, калькулятор, SEO, features, политика."""
import uuid


# ─────────── Фичефлаги ───────────

def test_features(client):
    r = client.get("/api/v1/features")
    assert r.status_code == 200
    data = r.json()
    for key in ["news", "faq", "advantages", "partners", "team", "documents", "calculator", "seo_admin"]:
        assert key in data and isinstance(data[key], bool)
    assert "construction" not in data  # «Ход стройки» удалён


# ─────────── Публичные списки контента (сидированы) ───────────

def test_public_content_lists_seeded(client):
    for path, minimum in [("news", 2), ("faq", 3), ("advantages", 9),
                          ("partners", 3), ("documents", 4), ("facts", 20),
                          ("site-texts", 16), ("hero-chapters", 6),
                          ("plan-categories", 3)]:
        r = client.get(f"/api/v1/{path}")
        assert r.status_code == 200, path
        assert len(r.json()) >= minimum, f"{path}: {len(r.json())}"
        assert all(item["active"] for item in r.json())
    # Команда сидируется пустой (заполняет заказчик), но роут работает
    r = client.get("/api/v1/team")
    assert r.status_code == 200


def test_news_by_slug(client):
    r = client.get("/api/v1/news/start-prodazh")
    assert r.status_code == 200
    assert r.json()["slug"] == "start-prodazh"
    assert client.get("/api/v1/news/net-takogo").status_code == 404


def test_documents_by_slug(client):
    r = client.get("/api/v1/documents/proektnaya-deklaraciya")
    assert r.status_code == 200
    assert r.json()["doc_type"] == "declaration"
    assert client.get("/api/v1/documents/net-takogo").status_code == 404


def test_site_texts_by_key(client):
    r = client.get("/api/v1/site-texts/about")
    assert r.status_code == 200
    assert r.json()["title"] == "Город у моря, продуманный для жизни"
    # ключи заголовков новых секций тоже сидированы
    for key in ["floorplans", "calculator", "news", "team", "faq", "partners"]:
        assert client.get(f"/api/v1/site-texts/{key}").status_code == 200, key


def test_facts_grouped(client):
    facts = client.get("/api/v1/facts").json()
    groups = {f["group"] for f in facts}
    assert groups == {"about", "trust", "nearby", "investment"}
    about = [f for f in facts if f["group"] == "about"]
    assert len(about) == 6


def test_policy_document(client):
    r = client.get("/api/v1/policy-document")
    assert r.status_code == 200
    assert r.json()["is_policy"] is True


# ─────────── Калькулятор рассрочки (X1) ───────────

def test_calculator_params(client):
    r = client.get("/api/v1/calculator")
    assert r.status_code == 200
    d = r.json()
    assert 0 <= d["min_down_payment_pct"] <= d["max_down_payment_pct"] <= 1
    assert 1 <= d["term_min_months"] <= d["term_max_months"]
    assert d["term_step_months"] >= 1
    assert d["markup_pct_annual"] >= 0


def test_calc_by_amount_defaults(client):
    """Дефолты: взнос = минимум (0.30), срок = максимум (36), удорожание 0."""
    r = client.post("/api/v1/calc", json={"mode": "amount", "amount": 5000000})
    assert r.status_code == 200
    d = r.json()
    assert d["price"] == 5000000
    assert d["down_payment_pct"] == 0.30
    assert d["down_payment"] == 1500000
    assert d["financed"] == 3500000
    assert d["months"] == 36
    assert d["markup"] == 0
    assert d["monthly_payment"] == round(3500000 / 36, 2)
    assert d["total_cost"] == 5000000
    assert "оферт" in d["disclaimer"].lower()


def test_calc_by_amount_explicit(client):
    r = client.post("/api/v1/calc", json={
        "mode": "amount", "amount": 5000000, "down_payment_pct": 0.5, "months": 12,
    })
    assert r.status_code == 200
    d = r.json()
    assert d["down_payment"] == 2500000
    assert d["financed"] == 2500000
    assert d["months"] == 12
    assert d["monthly_payment"] == round(2500000 / 12, 2)


def test_calc_by_floorplan(client):
    fp = client.get("/api/v1/floorplans/studiya-2682").json()
    r = client.post("/api/v1/calc", json={"mode": "floorplan", "floorplan_id": fp["id"]})
    assert r.status_code == 200
    assert r.json()["price"] == 4290000  # цена студии из seed


def test_calc_by_floorplan_price_per_m2_fallback(client):
    """У лота без цены стоимость = price_per_m2 × area (160000 × 40.95)."""
    fp = client.get("/api/v1/floorplans/apartament-4095").json()
    assert fp["price"] is None
    r = client.post("/api/v1/calc", json={"mode": "floorplan", "floorplan_id": fp["id"]})
    assert r.status_code == 200
    assert r.json()["price"] == round(160000 * 40.95, 2)


def test_calc_with_markup(client, admin_token, bearer):
    """Удорожание: financed × markup × months/12."""
    h = bearer(admin_token)
    assert client.put("/api/v1/admin/calculator", headers=h, json={"markup_pct_annual": 0.12}).status_code == 200
    try:
        r = client.post("/api/v1/calc", json={
            "mode": "amount", "amount": 1200000, "down_payment_pct": 0.5, "months": 12,
        })
        assert r.status_code == 200
        d = r.json()
        assert d["markup"] == 72000            # 600000 × 0.12 × 1 год
        assert d["monthly_payment"] == 56000   # (600000 + 72000) / 12
        assert d["total_cost"] == 1272000
    finally:
        client.put("/api/v1/admin/calculator", headers=h, json={"markup_pct_annual": 0.0})


def test_calc_validation(client):
    assert client.post("/api/v1/calc", json={"mode": "amount"}).status_code == 422
    assert client.post("/api/v1/calc", json={"mode": "floorplan"}).status_code == 422
    assert client.post("/api/v1/calc", json={"mode": "floorplan", "floorplan_id": str(uuid.uuid4())}).status_code == 404
    # взнос вне [min, max] и срок вне [term_min, term_max]
    assert client.post("/api/v1/calc", json={"mode": "amount", "amount": 1000000, "down_payment_pct": 0.1}).status_code == 422
    assert client.post("/api/v1/calc", json={"mode": "amount", "amount": 1000000, "months": 60}).status_code == 422


def test_calc_prices_hidden(client, admin_token, bearer):
    """З6: при скрытых ценах расчёт по планировке недоступен (не раскрывает цену)."""
    h = bearer(admin_token)
    fp = client.get("/api/v1/floorplans/studiya-2682").json()
    client.put("/api/v1/admin/settings", headers=h, json={"show_prices": False})
    try:
        assert client.post("/api/v1/calc", json={"mode": "floorplan", "floorplan_id": fp["id"]}).status_code == 422
        # по своей сумме — по-прежнему работает
        assert client.post("/api/v1/calc", json={"mode": "amount", "amount": 3000000}).status_code == 200
    finally:
        client.put("/api/v1/admin/settings", headers=h, json={"show_prices": True})


# ─────────── SEO (SEO2) ───────────

def test_seo_public_by_slug(client):
    r = client.get("/api/v1/seo", params={"slug": "/"})
    assert r.status_code == 200
    assert r.json()["slug"] == "/"
    assert client.get("/api/v1/seo", params={"slug": "/no-such"}).status_code == 404


def test_seo_admin_crud(client, admin_token, bearer):
    h = bearer(admin_token)
    slug = f"/test-{uuid.uuid4().hex[:6]}"
    r = client.post("/api/v1/admin/seo", headers=h, json={"slug": slug, "title": "T", "description": "D"})
    assert r.status_code == 201
    sid = r.json()["id"]
    assert client.get(f"/api/v1/admin/seo/{sid}", headers=h).status_code == 200
    assert client.put(f"/api/v1/admin/seo/{sid}", headers=h, json={"title": "T2"}).json()["title"] == "T2"
    assert client.delete(f"/api/v1/admin/seo/{sid}", headers=h).status_code == 204


# ─────────── Контент-CRUD + RBAC (на примере новостей) ───────────

def test_content_crud_and_rbac(client, admin_token, manager_token, bearer):
    ah, mh = bearer(admin_token), bearer(manager_token)
    # менеджеру контент недоступен
    assert client.get("/api/v1/admin/news", headers=mh).status_code == 403
    assert client.post("/api/v1/admin/faq", headers=mh, json={"question": "q", "answer": "a"}).status_code == 403
    # админ: полный CRUD новости
    slug = f"n-{uuid.uuid4().hex[:6]}"
    r = client.post("/api/v1/admin/news", headers=ah, json={"title": "Тест", "slug": slug})
    assert r.status_code == 201
    nid = r.json()["id"]
    assert client.post("/api/v1/admin/news", headers=ah, json={"title": "Дубль", "slug": slug}).status_code == 409
    assert client.put(f"/api/v1/admin/news/{nid}", headers=ah, json={"title": "Обновлено"}).json()["title"] == "Обновлено"
    # публично видна по слагу
    assert client.get(f"/api/v1/news/{slug}").status_code == 200
    assert client.delete(f"/api/v1/admin/news/{nid}", headers=ah).status_code == 204
    assert client.get(f"/api/v1/news/{slug}").status_code == 404


def test_calculator_admin_update(client, admin_token, manager_token, bearer):
    ah, mh = bearer(admin_token), bearer(manager_token)
    assert client.get("/api/v1/admin/calculator", headers=mh).status_code == 403
    r = client.put("/api/v1/admin/calculator", headers=ah, json={"min_down_payment_pct": 0.35})
    assert r.status_code == 200
    assert abs(r.json()["min_down_payment_pct"] - 0.35) < 1e-6
    # валидация: min > max — 422
    assert client.put("/api/v1/admin/calculator", headers=ah,
                      json={"min_down_payment_pct": 0.9, "max_down_payment_pct": 0.5}).status_code == 422
    assert client.put("/api/v1/admin/calculator", headers=ah,
                      json={"term_min_months": 24, "term_max_months": 12}).status_code == 422
    client.put("/api/v1/admin/calculator", headers=ah, json={"min_down_payment_pct": 0.30})


def test_plan_categories_admin_crud(client, admin_token, manager_token, bearer):
    ah, mh = bearer(admin_token), bearer(manager_token)
    assert client.get("/api/v1/admin/plan-categories", headers=mh).status_code == 403
    r = client.post("/api/v1/admin/plan-categories", headers=ah,
                    json={"title": "Видовые", "slug": "vidovye"})
    assert r.status_code == 201
    cid = r.json()["id"]
    # дубликат слага
    assert client.post("/api/v1/admin/plan-categories", headers=ah,
                       json={"title": "Дубль", "slug": "vidovye"}).status_code == 409
    assert client.put(f"/api/v1/admin/plan-categories/{cid}", headers=ah,
                      json={"title": "Видовые у моря"}).json()["title"] == "Видовые у моря"
    assert client.delete(f"/api/v1/admin/plan-categories/{cid}", headers=ah).status_code == 204


def test_advantage_category_roundtrip(client, admin_token, bearer):
    h = bearer(admin_token)
    r = client.post("/api/v1/admin/advantages", headers=h,
                    json={"title": "Тест-карточка", "category": "leisure"})
    assert r.status_code == 201
    aid = r.json()["id"]
    try:
        assert r.json()["category"] == "leisure"
        # невалидная категория отклоняется
        assert client.put(f"/api/v1/admin/advantages/{aid}", headers=h,
                          json={"category": "unknown"}).status_code == 422
    finally:
        client.delete(f"/api/v1/admin/advantages/{aid}", headers=h)


def test_analytics_metrika_roundtrip(client, admin_token, bearer):
    """X2: metrika_id задаётся в админке и публично отдаётся для инициализации после согласия."""
    h = bearer(admin_token)
    assert client.get("/api/v1/analytics").json()["metrika_id"] is None
    r = client.put("/api/v1/admin/settings", headers=h, json={"metrika_id": "12345678"})
    assert r.status_code == 200 and r.json()["metrika_id"] == "12345678"
    assert client.get("/api/v1/analytics").json()["metrika_id"] == "12345678"
    client.put("/api/v1/admin/settings", headers=h, json={"metrika_id": None})


def test_stats_dashboard(client, admin_token, manager_token, bearer):
    """Дашборд: структура агрегатов, инкремент счётчиков, доступ менеджеру."""
    h = bearer(admin_token)
    before = client.get("/api/v1/admin/stats", headers=h).json()
    # заявка с калькулятором и utm
    fp = client.get("/api/v1/floorplans/studiya-2682").json()
    client.post("/api/v1/leads", json={
        "name": "Статс Тест", "phone": "+7 900 777-11-22", "kind": "with_calc",
        "floorplan_id": fp["id"], "consent_given": True,
        "utm": {"utm_source": "yandex_stats"}, "source_block": "stats_block",
        "calc_snapshot": {
            "input": {"mode": "floorplan", "down_payment_pct": 0.3, "months": 36},
            "result": {"price": 4290000, "monthly_payment": 83416.67, "total_cost": 4290000},
        },
    })
    after = client.get("/api/v1/admin/stats", headers=h).json()
    assert after["totals"]["total"] == before["totals"]["total"] + 1
    assert after["totals"]["last7"] >= 1 and after["totals"]["last30"] >= after["totals"]["last7"]
    assert set(after["by_status"]) == {"new", "in_progress", "done"}
    assert len(after["daily"]) == 30 and after["daily"][-1]["count"] >= 1  # сегодня
    assert any(x["label"] == "yandex_stats" for x in after["by_utm"])
    assert any(x["label"] == "stats_block" for x in after["by_block"])
    assert any(x["label"] == "Студия 26,82 м²" for x in after["by_floorplan"])
    assert after["calc"]["with_calc"] >= 1
    assert after["calc"]["avg_price"] is not None
    assert after["calc"]["avg_monthly_payment"] is not None
    # простая заявка без снапшота НЕ должна попадать в счётчик калькулятора
    client.post("/api/v1/leads", json={"name": "Без Кальк", "phone": "+7 900 888-99-00", "consent_given": True})
    after2 = client.get("/api/v1/admin/stats", headers=h).json()
    assert after2["calc"]["with_calc"] == after["calc"]["with_calc"]
    # менеджеру дашборд доступен (его рабочие цифры)
    assert client.get("/api/v1/admin/stats", headers=bearer(manager_token)).status_code == 200
