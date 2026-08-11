# Алые Паруса — сайт апарт-комплекса и система управления

Продающий сайт апарт-комплекса «Алые Паруса» (Дагестан, первая береговая линия
Каспия) с CMS: контент главной, каталог планировок, новости, документы,
калькулятор рассрочки и приём заявок управляются из админ-панели.

```
backend/          FastAPI + SQLAlchemy + PostgreSQL — API, админ-API, медиа
frontend-admin/   Next.js — админ-панель (CMS)
web/              Next.js — публичный сайт
deploy/           продакшен: compose под общий nginx, SSL, врезка доменов
docs/             документация (см. ниже)
scripts/          вспомогательные скрипты
Makefile          установка и обновление: make help
docker-compose.yml   локальный стек целиком

```

Исходники видео (`materials/`), тексты проекта (`content/`) и коммерческие
документы в репозиторий не входят: он публичный.

## Боевой сайт

| Что | Адрес |
|---|---|
| Сайт | https://cherkesov.mediann.dev |
| Админка | https://admin.cherkesov.mediann.dev |
| API | https://api.cherkesov.mediann.dev/docs |

Обновление боевого сервера — `make deploy` в `/opt/parusa` (см.
[docs/DEPLOY.md](docs/DEPLOY.md)).

## Быстрый старт локально

```bash
make dev-up          # или docker compose up --build
```

Бэкенд на старте сам создаёт таблицы, применяет DDL-патчи и заливает seed-контент
«Алых Парусов» — отдельной команды миграции не нужно.

| Что | URL |
|---|---|
| Сайт | http://localhost:3000 |
| Админка | http://localhost:3001 |
| API + Swagger | http://localhost:8000/docs |
| MinIO (консоль) | http://localhost:9001 |

Доступы в админку (создаются seed-ом):

| Роль | Логин | Пароль | Что доступно |
|---|---|---|---|
| Суперадмин | `admin@alyeparusa.local` | `admin12345` | всё |
| Менеджер | `manager@alyeparusa.local` | `manager12345` | заявки и контент, без настроек/SEO/калькулятора |

Остановить: `docker compose down` · со сбросом базы и медиа: `docker compose down -v`.

## Документация

| Файл | О чём |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Как устроены три приложения, слои, ключевые решения и их причины |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Локальная разработка без Docker, тесты, гейты, частые грабли |
| [docs/API.md](docs/API.md) | Эндпоинты, авторизация, коды ошибок, конвенции |
| [docs/CONTENT-MAP.md](docs/CONTENT-MAP.md) | Какой раздел админки за какой блок сайта отвечает |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Продакшен: домены, секреты, обновление, бэкапы |
| [docs/MEDIA.md](docs/MEDIA.md) | Hero-видео: как собрано и как пересобрать |
| [web/README.md](web/README.md) | Внутреннее устройство сайта (архитектура слоёв, скролл-hero) |

## Стек

- **Backend:** Python 3.11, FastAPI, SQLAlchemy 2.0 (sync), PostgreSQL 16, JWT-авторизация, pytest
- **Сайт:** Next.js 15 (App Router, RSC), React 19, TypeScript strict, CSS Modules, GSAP + Lenis, Vitest
- **Админка:** Next.js 15, React 19, TypeScript strict, конфигурируемые ресурсы (без UI-фреймворка)
- **Инфраструктура:** Docker Compose, MinIO (S3-совместимое хранилище), nginx + Let's Encrypt

## Контент

Тексты и цифры проекта зашиты в seed (`backend/app/seed.py`) и дальше правятся
через админку — карта соответствия разделов и блоков в
[docs/CONTENT-MAP.md](docs/CONTENT-MAP.md).
