"""301-редиректы: авто-создание при смене слага, анти-петли, CRUD, резолв."""
import uuid


def _mk_news(client, h, title="Ред Тест"):
    slug = f"red-{uuid.uuid4().hex[:8]}"
    r = client.post("/api/v1/admin/news", headers=h, json={"title": title, "slug": slug})
    assert r.status_code == 201, r.text
    return r.json()["id"], slug


def test_news_slug_change_creates_redirect(client, admin_token, bearer):
    h = bearer(admin_token)
    nid, old = _mk_news(client, h)
    new = f"{old}-x"
    assert client.put(f"/api/v1/admin/news/{nid}", headers=h, json={"slug": new}).status_code == 200
    r = client.get("/api/v1/redirects/resolve", params={"path": f"/novosti/{old}"})
    assert r.status_code == 200
    assert r.json()["to_path"] == f"/novosti/{new}"
    # нормализация: хвостовой слэш и query не мешают резолву
    r2 = client.get("/api/v1/redirects/resolve", params={"path": f"/novosti/{old}/?utm_source=x"})
    assert r2.status_code == 200 and r2.json()["to_path"] == f"/novosti/{new}"
    assert client.get("/api/v1/redirects/resolve", params={"path": "/net-takogo"}).status_code == 404
    client.delete(f"/api/v1/admin/news/{nid}", headers=h)


def test_floorplan_slug_change_creates_redirect(client, admin_token, bearer):
    h = bearer(admin_token)
    slug = f"fp-{uuid.uuid4().hex[:8]}"
    r = client.post("/api/v1/admin/floorplans", headers=h,
                    json={"title": "Ред Планировка", "slug": slug, "area_m2": 30})
    fid = r.json()["id"]
    client.put(f"/api/v1/admin/floorplans/{fid}", headers=h, json={"slug": f"{slug}-new"})
    r = client.get("/api/v1/redirects/resolve", params={"path": f"/planirovki/{slug}"})
    assert r.status_code == 200
    assert r.json()["to_path"] == f"/planirovki/{slug}-new"
    client.delete(f"/api/v1/admin/floorplans/{fid}", headers=h)


def test_redirect_no_loops_and_flatten(client, admin_token, bearer):
    h = bearer(admin_token)
    nid, a = _mk_news(client, h)
    b, c = f"{a}-b", f"{a}-c"
    # A → B, затем B → C: старый /A должен вести сразу в /C (flatten)
    client.put(f"/api/v1/admin/news/{nid}", headers=h, json={"slug": b})
    client.put(f"/api/v1/admin/news/{nid}", headers=h, json={"slug": c})
    r = client.get("/api/v1/redirects/resolve", params={"path": f"/novosti/{a}"})
    assert r.status_code == 200 and r.json()["to_path"] == f"/novosti/{c}"
    # C → A (возврат): редиректа С /A быть не должно — страница снова живая
    client.put(f"/api/v1/admin/news/{nid}", headers=h, json={"slug": a})
    assert client.get("/api/v1/redirects/resolve", params={"path": f"/novosti/{a}"}).status_code == 404
    # а /B и /C ведут в /A
    for old in (b, c):
        r = client.get("/api/v1/redirects/resolve", params={"path": f"/novosti/{old}"})
        assert r.status_code == 200 and r.json()["to_path"] == f"/novosti/{a}"
    client.delete(f"/api/v1/admin/news/{nid}", headers=h)


def test_redirect_admin_crud(client, admin_token, manager_token, bearer):
    ah, mh = bearer(admin_token), bearer(manager_token)
    assert client.get("/api/v1/admin/redirects", headers=mh).status_code == 403
    r = client.post("/api/v1/admin/redirects", headers=ah,
                    json={"from_path": "/staraya", "to_path": "/novaya", "note": "ручной"})
    assert r.status_code == 201
    rid = r.json()["id"]
    # дубликат from_path и петля
    assert client.post("/api/v1/admin/redirects", headers=ah,
                       json={"from_path": "/staraya", "to_path": "/x"}).status_code == 409
    assert client.post("/api/v1/admin/redirects", headers=ah,
                       json={"from_path": "/loop", "to_path": "/loop"}).status_code == 422
    assert client.post("/api/v1/admin/redirects", headers=ah,
                       json={"from_path": "bez-slesha", "to_path": "/x"}).status_code == 422
    # выключенный редирект не резолвится
    assert client.put(f"/api/v1/admin/redirects/{rid}", headers=ah, json={"active": False}).status_code == 200
    assert client.get("/api/v1/redirects/resolve", params={"path": "/staraya"}).status_code == 404
    assert client.delete(f"/api/v1/admin/redirects/{rid}", headers=ah).status_code == 204


def test_redirect_reverse_edit_survives(client, admin_token, bearer):
    """Регресс: PUT-разворот /a→/b в /b→/a не должен удалять саму запись (500)."""
    h = bearer(admin_token)
    r = client.post("/api/v1/admin/redirects", headers=h,
                    json={"from_path": "/rev-a", "to_path": "/rev-b"})
    assert r.status_code == 201
    rid = r.json()["id"]
    r = client.put(f"/api/v1/admin/redirects/{rid}", headers=h,
                   json={"from_path": "/rev-b", "to_path": "/rev-a"})
    assert r.status_code == 200, r.text
    assert r.json()["from_path"] == "/rev-b" and r.json()["to_path"] == "/rev-a"
    resolved = client.get("/api/v1/redirects/resolve", params={"path": "/rev-b"})
    assert resolved.status_code == 200 and resolved.json()["to_path"] == "/rev-a"
    client.delete(f"/api/v1/admin/redirects/{rid}", headers=h)


def test_inactive_redirect_does_not_touch_others(client, admin_token, bearer):
    """Регресс: неактивный черновик не переписывает работающие редиректы."""
    h = bearer(admin_token)
    live = client.post("/api/v1/admin/redirects", headers=h,
                       json={"from_path": "/live-old", "to_path": "/live-new"}).json()
    draft = client.post("/api/v1/admin/redirects", headers=h,
                        json={"from_path": "/draft-x", "to_path": "/live-old", "active": False}).json()
    assert client.get("/api/v1/redirects/resolve", params={"path": "/live-old"}).json()["to_path"] == "/live-new"
    got = client.get(f"/api/v1/admin/redirects/{draft['id']}", headers=h).json()
    assert got["to_path"] == "/live-old"
    for rid in (live["id"], draft["id"]):
        client.delete(f"/api/v1/admin/redirects/{rid}", headers=h)
