"""API-тесты публичных эндпоинтов + фичефлаг цены (З6) + категории (ЧПУ)."""
SEED_SLUGS = {"studiya-2682", "apartament-5066", "apartament-7351", "studiya-2619"}


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_floorplans_list(client):
    r = client.get("/api/v1/floorplans")
    assert r.status_code == 200
    data = r.json()
    slugs = {f["slug"] for f in data}
    assert SEED_SLUGS.issubset(slugs)
    # публичный список отдаёт только активные
    assert all(f["active"] for f in data)


def test_floorplan_by_slug(client):
    r = client.get("/api/v1/floorplans/studiya-2682")
    assert r.status_code == 200
    fp = r.json()
    assert fp["slug"] == "studiya-2682"
    assert float(fp["area_m2"]) == 26.82


def test_floorplan_unknown_404(client):
    r = client.get("/api/v1/floorplans/does-not-exist")
    assert r.status_code == 404


def test_plan_categories_list(client):
    r = client.get("/api/v1/plan-categories")
    assert r.status_code == 200
    slugs = {c["slug"] for c in r.json()}
    assert {"studii", "odnokomnatnye", "dvuhkomnatnye"}.issubset(slugs)
    # и по слагу
    r = client.get("/api/v1/plan-categories/studii")
    assert r.status_code == 200
    assert r.json()["title"] == "Студии"
    assert client.get("/api/v1/plan-categories/net-takoy").status_code == 404


def test_floorplans_category_filter(client):
    """ЧПУ-фильтр: ?category={slug}; неизвестный слаг → 404 (резолв одного сегмента)."""
    r = client.get("/api/v1/floorplans", params={"category": "studii"})
    assert r.status_code == 200
    data = r.json()
    assert data, "в категории «Студии» есть сидированные лоты"
    assert all(f["category"] and f["category"]["slug"] == "studii" for f in data)
    assert client.get("/api/v1/floorplans", params={"category": "no-such"}).status_code == 404


def test_floorplan_payload_has_category(client):
    fp = client.get("/api/v1/floorplans/studiya-2682").json()
    assert fp["category"]["slug"] == "studii"
    assert "plan_type" not in fp


def test_banner(client):
    r = client.get("/api/v1/banner")
    assert r.status_code == 200
    assert "title" in r.json()


def test_contacts(client):
    r = client.get("/api/v1/contacts")
    assert r.status_code == 200
    assert "phone" in r.json()


def test_show_prices_flag_hides_price(client, admin_token, bearer):
    """З6: show_prices=false → публичный API отдаёт price=null для всех."""
    # по умолчанию цены есть хотя бы у одной планировки
    before = client.get("/api/v1/floorplans").json()
    assert any(f["price"] is not None for f in before)
    try:
        r = client.put("/api/v1/admin/settings", headers=bearer(admin_token), json={"show_prices": False})
        assert r.status_code == 200
        hidden = client.get("/api/v1/floorplans").json()
        assert all(f["price"] is None for f in hidden)
        # и на карточке по слагу тоже
        one = client.get("/api/v1/floorplans/studiya-2682").json()
        assert one["price"] is None
    finally:
        client.put("/api/v1/admin/settings", headers=bearer(admin_token), json={"show_prices": True})
    restored = client.get("/api/v1/floorplans").json()
    assert any(f["price"] is not None for f in restored)
