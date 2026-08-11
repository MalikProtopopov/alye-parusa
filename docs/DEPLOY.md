# Продакшен

Стек: `deploy/docker-compose.prod.yml` + `deploy/Caddyfile`. Наружу открыты
только 80 и 443 — TLS Caddy выпускает сам через Let's Encrypt.

```
Caddy ─┬─ alyeparusa.<домен>        → client (сайт)
       ├─ admin.alyeparusa.<домен>  → admin  (админка, noindex)
       └─ api.alyeparusa.<домен>    → backend (API, noindex)
                                       ├─ postgres
                                       └─ minio
```

## Перед первым запуском

**1. Домены.** В `deploy/Caddyfile` сейчас стоят заглушки
(`alyeparusa.mediann.dev`). Замени на реальные во всех четырёх блоках — Caddy
пойдёт за сертификатом сразу после `up -d`, и на несуществующий домен получит
отказ от Let's Encrypt с лимитом на повторы.

Те же домены продублированы в `docker-compose.prod.yml` (`CORS_ORIGINS`,
`ADMIN_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`). Значения
`NEXT_PUBLIC_*` **вшиваются в бандл на этапе сборки** — поменять их потом через
`environment` нельзя, нужна пересборка образа.

**2. DNS.** A-записи для apex, `www`, `admin`, `api` на IP сервера.

**3. Секреты** — `deploy/.env.prod` (в репозиторий не коммитить):

| Переменная | Что |
|---|---|
| `POSTGRES_PASSWORD` | пароль базы |
| `JWT_SECRET` | подпись токенов; смена разлогинивает всех |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | доступ к MinIO |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | уведомления о заявках (без них заявки сохраняются, но не приходят) |

**4. Пароли демо-учёток.** Seed создаёт `admin@alyeparusa.local` и
`manager@alyeparusa.local` с паролями из настроек. На боевом сервере задай
`SEED_SUPERADMIN_PASSWORD` и `SEED_MANAGER_PASSWORD` **до первого запуска** —
seed не перезаписывает уже созданные учётки, менять придётся вручную в базе.

## Запуск

```bash
cd /opt/alyeparusa/deploy
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Бэкенд на старте создаст схему, применит DDL-патчи и зальёт seed-контент.
Отдельной команды миграции нет.

Проверка после запуска:

```bash
curl -sf https://api.<домен>/health                    # {"status":"ok"}
curl -s  https://<домен>/robots.txt | head             # правила + ссылка на sitemap
curl -s  https://<домен>/sitemap.xml | head            # реальные даты изменения
curl -sI https://admin.<домен> | grep -i x-robots      # noindex, nofollow
```

## Обновление

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Пересобираются только изменившиеся образы. Если менялись домены или
`NEXT_PUBLIC_*` — добавь `--no-cache` для `client` и `admin`, иначе Next возьмёт
закэшированный слой со старыми значениями.

## Файлы и база

Загрузки из админки лежат в MinIO (том `miniodata`), база — в `pgdata`. MinIO
наружу не публикуется: файлы отдаёт бэкенд по `/media/{name}`, а сайт проксирует
их как `/cms-media/*`, чтобы браузер видел один домен. Консоль MinIO при
необходимости — через SSH-туннель на порт 9001.

Бэкап (обе части нужны вместе — база хранит имена файлов, хранилище сами файлы):

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U parusa parusa | gzip > backup-$(date +%F).sql.gz

docker run --rm -v alyeparusa_miniodata:/data -v "$PWD":/out alpine \
  tar czf /out/media-$(date +%F).tar.gz -C /data .
```

Восстановление базы: `gunzip -c backup.sql.gz | docker compose … exec -T postgres
psql -U parusa parusa`.

## Кэширование

Caddy проставляет годовой иммутабельный кэш на `/media/*`, `/cms-media/*` и
`/icons/*` — имена этих файлов содержат хэш содержимого, поэтому обновление
безопасно. OG-обложка кэшируется на сутки: она может перегенерироваться.

Сам сайт кэширует данные из API с фоновой ревалидацией — правка в админке
доезжает до посетителей примерно за минуту.

## После запуска — обязательное

- Подключить домен в Яндекс.Вебмастере и Google Search Console, вставить коды
  подтверждения в **Настройки** админки (сайт отдаёт их в мета-тегах).
- Отправить `sitemap.xml` в оба сервиса.
- Вставить номер счётчика Яндекс.Метрики в **Настройки**.
- Задать `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID`, проверить кнопкой
  «Отправить тестовое сообщение» в настройках.
- Убедиться, что в **Документах** есть активная Политика обработки данных: на
  неё ссылаются формы сайта (152-ФЗ).
- Проверить `NEXT_PUBLIC_SHOW_DEMO_CREDS` — на боевом экране входа демо-доступов
  быть не должно (в продакшен-сборке переменная не задаётся).
