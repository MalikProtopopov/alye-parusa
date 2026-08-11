"""Фикстуры pytest. Тесты бьют по отдельной тестовой БД (порт 55433 по умолчанию,
или переменная TEST_DATABASE_URL). DATABASE_URL выставляется ДО импорта приложения,
чтобы движок и стартовый seed использовали именно тестовую базу."""
import os

os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+psycopg2://parusa:parusa@localhost:55433/parusa_test",
)
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    # чистая схема на сессию; startup TestClient создаёт таблицы и заливает seed
    Base.metadata.drop_all(bind=engine)
    with TestClient(app) as c:
        yield c
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def admin_token(client) -> str:
    r = client.post(
        "/api/v1/admin/auth/login",
        json={"email": "admin@alyeparusa.local", "password": "admin12345"},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture()
def manager_token(client) -> str:
    r = client.post(
        "/api/v1/admin/auth/login",
        json={"email": "manager@alyeparusa.local", "password": "manager12345"},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture()
def bearer():
    return lambda token: {"Authorization": f"Bearer {token}"}
