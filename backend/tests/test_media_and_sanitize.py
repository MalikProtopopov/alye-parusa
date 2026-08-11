"""Тесты загрузки медиа (DnD из админки) и санитизации WYSIWYG-HTML."""
import io
import uuid

from PIL import Image


def _png_bytes(w=400, h=300, color=(191, 150, 111)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), color).save(buf, format="PNG")
    return buf.getvalue()


def _jpeg_bytes(w=400, h=300) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), (61, 115, 115)).save(buf, format="JPEG")
    return buf.getvalue()


# ─────────── Загрузка медиа ───────────

def test_upload_png_ok(client, admin_token, bearer):
    """Пайплайн: оригинал сохранён, основной url — оптимизированный WebP + превью."""
    r = client.post(
        "/api/v1/admin/media",
        headers=bearer(admin_token),
        files={"file": ("plan.png", _png_bytes(), "image/png")},
    )
    assert r.status_code == 201, r.text
    d = r.json()
    assert d["kind"] == "image"
    assert d["path"].endswith(".webp")                     # основной — webp
    assert d["original_url"] and "_orig.png" in d["original_url"]  # оригинал сохранён
    assert d["thumb_url"] and "_thumb.webp" in d["thumb_url"]
    assert d["width"] == 400 and d["height"] == 300        # без апскейла
    assert client.get(d["path"]).status_code == 200
    assert client.get("/media/" + d["original_url"].split("/media/")[1]).status_code == 200


def test_upload_jpeg_renamed_by_real_format(client, admin_token, bearer):
    """Формат оригинала берётся из ФАКТИЧЕСКОГО содержимого, не из имени файла."""
    r = client.post(
        "/api/v1/admin/media",
        headers=bearer(admin_token),
        files={"file": ("fake.png", _jpeg_bytes(), "image/png")},  # ложь в имени и mime
    )
    assert r.status_code == 201
    assert "_orig.jpg" in r.json()["original_url"]  # определили как JPEG


def test_upload_pdf_ok(client, admin_token, bearer):
    pdf = b"%PDF-1.4\n%demo\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"
    r = client.post(
        "/api/v1/admin/media",
        headers=bearer(admin_token),
        files={"file": ("doc.pdf", pdf, "application/pdf")},
    )
    assert r.status_code == 201
    assert r.json()["path"].endswith(".pdf")


def test_upload_garbage_rejected_415(client, admin_token, bearer):
    r = client.post(
        "/api/v1/admin/media",
        headers=bearer(admin_token),
        files={"file": ("virus.exe", b"MZ\x90\x00 not an image", "image/png")},
    )
    assert r.status_code == 415


def test_upload_empty_rejected(client, admin_token, bearer):
    r = client.post(
        "/api/v1/admin/media",
        headers=bearer(admin_token),
        files={"file": ("empty.png", b"", "image/png")},
    )
    assert r.status_code == 422


def test_upload_oversize_rejected_413(client, admin_token, bearer, monkeypatch):
    from app.config import settings as s
    monkeypatch.setattr(s, "media_max_mb", 1)
    big = _png_bytes(3000, 3000)  # ~ > 1MB несжатых пикселей → png > 1MB
    if len(big) <= 1024 * 1024:  # страховка от слишком хорошей компрессии
        big = big + b"\x00" * (1024 * 1024)
    r = client.post(
        "/api/v1/admin/media",
        headers=bearer(admin_token),
        files={"file": ("big.png", big, "image/png")},
    )
    assert r.status_code == 413


def test_media_library_list_and_delete(client, admin_token, manager_token, bearer):
    """Галерея: загруженные файлы видны в списке (новые первыми), удаление работает."""
    h = bearer(admin_token)
    up = client.post("/api/v1/admin/media", headers=h,
                     files={"file": ("lib.png", _png_bytes(500, 200), "image/png")}).json()
    name = up["path"].split("/")[-1]  # основной .webp
    lst = client.get("/api/v1/admin/media", headers=h)
    assert lst.status_code == 200
    items = lst.json()["items"]
    assert any(i["name"] == name for i in items)
    first = next(i for i in items if i["name"] == name)
    assert {"name", "url", "path", "content_type", "size", "uploaded_at", "original_url", "thumb_url"} <= set(first)
    assert first["original_url"] and first["thumb_url"]     # варианты приложены
    assert not any("_orig" in i["name"] or "_thumb" in i["name"] for i in items)  # варианты не отдельными строками
    # менеджеру галерея недоступна
    assert client.get("/api/v1/admin/media", headers=bearer(manager_token)).status_code == 403
    # удаление сносит и варианты
    orig_path = "/media/" + up["original_url"].split("/media/")[1]
    assert client.delete(f"/api/v1/admin/media/{name}", headers=h).status_code == 204
    assert not any(i["name"] == name for i in client.get("/api/v1/admin/media", headers=h).json()["items"])
    assert client.get(orig_path).status_code == 404
    # защита от path traversal
    assert client.delete("/api/v1/admin/media/..%2Fsecret", headers=h).status_code in (404, 422)


def test_upload_requires_admin(client, manager_token, bearer):
    r = client.post(
        "/api/v1/admin/media",
        headers=bearer(manager_token),
        files={"file": ("a.png", _png_bytes(), "image/png")},
    )
    assert r.status_code == 403


# ─────────── Санитизация WYSIWYG ───────────

def test_news_body_sanitized_on_create(client, admin_token, bearer):
    h = bearer(admin_token)
    slug = f"xss-{uuid.uuid4().hex[:6]}"
    dirty = (
        '<h2>Заголовок</h2><p onclick="alert(1)">Текст <strong>жирный</strong>'
        '<script>alert("xss")</script></p>'
        '<a href="javascript:alert(1)">плохая ссылка</a>'
        '<a href="https://example.com" target="_blank">хорошая ссылка</a>'
    )
    r = client.post("/api/v1/admin/news", headers=h, json={"title": "XSS", "slug": slug, "body": dirty})
    assert r.status_code == 201
    body = r.json()["body"]
    assert "<script" not in body and "alert(" not in body.replace("alert(1)", "") or "<script" not in body
    assert "onclick" not in body
    assert "javascript:" not in body
    assert "<strong>жирный</strong>" in body
    assert '<h2>Заголовок</h2>' in body
    assert 'href="https://example.com"' in body
    # публичный API отдаёт уже чистый HTML
    pub = client.get(f"/api/v1/news/{slug}").json()
    assert "<script" not in (pub["body"] or "")
    client.delete(f"/api/v1/admin/news/{r.json()['id']}", headers=h)


def test_faq_advantage_floorplan_rich_sanitized(client, admin_token, bearer):
    """Rich-lite поля (faq.answer, advantage.text, floorplan.description) тоже чистятся."""
    h = bearer(admin_token)
    # FAQ
    r = client.post("/api/v1/admin/faq", headers=h, json={
        "question": "Тест?", "answer": '<p style="background:yellow">Да, <strong>можно</strong></p><script>x</script>'})
    assert r.status_code == 201
    a = r.json()["answer"]
    assert "<strong>можно</strong>" in a and "style=" not in a and "<script" not in a
    client.delete(f"/api/v1/admin/faq/{r.json()['id']}", headers=h)
    # Advantage
    r = client.post("/api/v1/admin/advantages", headers=h, json={
        "title": "Т", "text": '<span style="color:red">цвет</span> и <em>курсив</em>'})
    t = r.json()["text"]
    assert "<em>курсив</em>" in t and "span" not in t and "style" not in t
    client.delete(f"/api/v1/admin/advantages/{r.json()['id']}", headers=h)
    # Floorplan description
    r = client.post("/api/v1/admin/floorplans", headers=h, json={
        "title": "Т", "slug": f"rich-{uuid.uuid4().hex[:6]}", "area_m2": 30,
        "description": '<p>Вид на море<img src=x onerror=alert(1)></p>'})
    d = r.json()["description"]
    assert "Вид на море" in d and "<img" not in d
    client.delete(f"/api/v1/admin/floorplans/{r.json()['id']}", headers=h)
    # Document description (аннотация для /dokumenty)
    r = client.post("/api/v1/admin/documents", headers=h, json={
        "title": f"Док {uuid.uuid4().hex[:6]}", "slug": f"dok-{uuid.uuid4().hex[:6]}",
        "doc_type": "other", "url": "https://example.com",
        "description": '<p>Аннотация <b>важно</b><style>bad</style></p>'})
    assert r.status_code == 201
    dd = r.json()["description"]
    assert "<b>важно</b>" in dd and "<style" not in dd and "bad" not in dd
    client.delete(f"/api/v1/admin/documents/{r.json()['id']}", headers=h)


def test_news_body_sanitized_on_update(client, admin_token, bearer):
    h = bearer(admin_token)
    slug = f"xss-upd-{uuid.uuid4().hex[:6]}"
    r = client.post("/api/v1/admin/news", headers=h, json={"title": "Upd", "slug": slug})
    nid = r.json()["id"]
    r2 = client.put(f"/api/v1/admin/news/{nid}", headers=h,
                    json={"body": '<p>ок</p><img src=x onerror=alert(1)><ul><li>пункт</li></ul>'})
    assert r2.status_code == 200
    body = r2.json()["body"]
    assert "<img" not in body and "onerror" not in body
    assert "<ul><li>пункт</li></ul>" in body
    client.delete(f"/api/v1/admin/news/{nid}", headers=h)

def test_big_image_downscaled_original_kept(client, admin_token, bearer):
    """Большое изображение ужимается до 1600px (WebP), оригинал — байт в байт."""
    import io as _io
    from PIL import Image as _Img
    src = _png_bytes(2400, 1200)
    r = client.post("/api/v1/admin/media", headers=bearer(admin_token),
                    files={"file": ("big.png", src, "image/png")})
    d = r.json()
    assert d["width"] == 1600 and d["height"] == 800  # даунскейл с сохранением пропорций
    opt = client.get(d["path"]).content
    img = _Img.open(_io.BytesIO(opt))
    assert img.format == "WEBP" and img.width == 1600
    assert len(opt) < len(src)  # веб-версия легче
    orig = client.get("/media/" + d["original_url"].split("/media/")[1]).content
    assert orig == src  # оригинал не тронут


def test_video_upload_transcoded(client, admin_token, bearer):
    """Видео: оригинал сохранён, основной — H.264 mp4 (faststart) + постер."""
    import shutil as _sh
    import subprocess as _sp
    import pytest as _pt
    if _sh.which("ffmpeg") is None:
        _pt.skip("ffmpeg отсутствует на хосте")
    _sp.run(["ffmpeg", "-y", "-f", "lavfi", "-i", "testsrc=duration=1:size=640x360:rate=10",
             "-pix_fmt", "yuv420p", "/tmp/bm-test-video.mp4"], check=True, capture_output=True)
    data = open("/tmp/bm-test-video.mp4", "rb").read()
    r = client.post("/api/v1/admin/media", headers=bearer(admin_token),
                    files={"file": ("clip.mp4", data, "video/mp4")})
    assert r.status_code == 201, r.text
    d = r.json()
    assert d["kind"] == "video"
    assert d["path"].endswith(".mp4") and "_orig" not in d["path"]
    assert d["original_url"] and "_orig.mp4" in d["original_url"]
    assert d["thumb_url"] and "_thumb.jpg" in d["thumb_url"]
    assert client.get(d["path"]).status_code == 200
    assert client.get("/media/" + d["thumb_url"].split("/media/")[1]).status_code == 200


def test_gif_passthrough(client, admin_token, bearer):
    """GIF не пережимается (анимации), отдаётся как есть."""
    import io as _io
    from PIL import Image as _Img
    buf = _io.BytesIO()
    _Img.new("P", (120, 80)).save(buf, format="GIF")
    r = client.post("/api/v1/admin/media", headers=bearer(admin_token),
                    files={"file": ("a.gif", buf.getvalue(), "image/gif")})
    d = r.json()
    assert d["kind"] == "gif" and d["path"].endswith(".gif")
    assert d["original_url"] is None and d["thumb_url"] is None
