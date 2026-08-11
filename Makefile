# «Алые Паруса» — установка, обновление и обслуживание.
#
# На сервере:  make install   (первый раз)  ·  make deploy  (обновление из git)
# Локально:    make dev-up    ·  make test
#
# Все секреты живут в deploy/.env.prod, который создаётся командой make env
# и НИКОГДА не попадает в git: репозиторий публичный.

SHELL := /bin/bash
.DEFAULT_GOAL := help

COMPOSE      := docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod
ENV_FILE     := deploy/.env.prod
DB_USER      := parusa
DB_NAME      := parusa
BACKUP_DIR   := backups
STAMP        := $(shell date +%Y%m%d-%H%M%S)

# Цвета для читаемого вывода
C := \033[36m
G := \033[32m
Y := \033[33m
R := \033[31m
N := \033[0m

.PHONY: help
help: ## Показать доступные команды
	@echo ""
	@echo -e "  $(C)«Алые Паруса» — управление$(N)"
	@echo ""
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(G)%-18s$(N) %s\n", $$1, $$2}'
	@echo ""
	@echo -e "  Первый запуск на сервере: $(Y)make install$(N)"
	@echo -e "  Обновление из git:        $(Y)make deploy$(N)"
	@echo ""

# ─────────────────────────── Продакшен ───────────────────────────

.PHONY: env
env: ## Создать deploy/.env.prod со случайными секретами (существующий не трогает)
	@if [ -f $(ENV_FILE) ]; then \
	  echo -e "  $(Y)$(ENV_FILE) уже есть — оставляю как есть$(N)"; \
	else \
	  mkdir -p deploy; \
	  { \
	    echo "# Секреты продакшена. В git не попадает (см. .gitignore)."; \
	    echo "# Создан $(STAMP) командой make env."; \
	    echo ""; \
	    echo "# Домены"; \
	    echo "SITE_DOMAIN=$${SITE_DOMAIN:-cherkesov.mediann.dev}"; \
	    echo "ADMIN_DOMAIN=$${ADMIN_DOMAIN:-admin.cherkesov.mediann.dev}"; \
	    echo "API_DOMAIN=$${API_DOMAIN:-api.cherkesov.mediann.dev}"; \
	    echo ""; \
	    echo "# Сеть общего nginx на этом сервере"; \
	    echo "NGINX_NETWORK=$${NGINX_NETWORK:-client_network_prod}"; \
	    echo "NGINX_CONF=$${NGINX_CONF:-/opt/mediannfront/nginx/nginx.conf}"; \
	    echo "NGINX_CONTAINER=$${NGINX_CONTAINER:-client_nginx_prod}"; \
	    echo "CERT_VOLUME=$${CERT_VOLUME:-client_certbot_certs}"; \
	    echo "CERTBOT_WEBROOT_VOLUME=$${CERTBOT_WEBROOT_VOLUME:-client_certbot_webroot}"; \
	    echo "LETSENCRYPT_EMAIL=$${LETSENCRYPT_EMAIL:-magamantium@gmail.com}"; \
	    echo ""; \
	    echo "# База, хранилище, подписи"; \
	    echo "POSTGRES_PASSWORD=$$(openssl rand -hex 24)"; \
	    echo "JWT_SECRET=$$(openssl rand -hex 32)"; \
	    echo "S3_ACCESS_KEY=parusa"; \
	    echo "S3_SECRET_KEY=$$(openssl rand -hex 24)"; \
	    echo "S3_BUCKET=parusa-media"; \
	    echo ""; \
	    echo "# Учётки админки (создаются при первом старте)"; \
	    echo "SEED_SUPERADMIN_EMAIL=admin@alyeparusa.ru"; \
	    echo "SEED_SUPERADMIN_PASSWORD=$$(openssl rand -base64 15 | tr -d '/+=' | cut -c1-14)"; \
	    echo "SEED_MANAGER_EMAIL=manager@alyeparusa.ru"; \
	    echo "SEED_MANAGER_PASSWORD=$$(openssl rand -base64 15 | tr -d '/+=' | cut -c1-14)"; \
	    echo ""; \
	    echo "# Уведомления о заявках (заполнить, когда будет бот)"; \
	    echo "TELEGRAM_BOT_TOKEN="; \
	    echo "TELEGRAM_CHAT_ID="; \
	  } > $(ENV_FILE); \
	  chmod 600 $(ENV_FILE); \
	  echo -e "  $(G)создан $(ENV_FILE)$(N) — пароли внутри, сохраните их"; \
	fi

.PHONY: install
install: env build up ## Первая установка: секреты, сборка, запуск, SSL, nginx
	@# Порядок важен: сначала nginx отдаёт http и ACME-проверку, только потом
	@# выпускаются сертификаты, и лишь затем добавляются https-блоки.
	@$(MAKE) --no-print-directory nginx
	@$(MAKE) --no-print-directory ssl
	@$(MAKE) --no-print-directory nginx
	@echo ""
	@echo -e "  $(G)Установка завершена.$(N) Доступы в админку:"
	@grep -E '^SEED_(SUPERADMIN|MANAGER)_(EMAIL|PASSWORD)=' $(ENV_FILE) | sed 's/^/    /'
	@$(MAKE) --no-print-directory urls

.PHONY: deploy
deploy: pull build up nginx prune ## Обновление: git pull, пересборка, перезапуск
	@$(MAKE) --no-print-directory urls

.PHONY: pull
pull: ## Забрать свежий код из git
	@echo -e "  $(C)git pull$(N)"
	@git pull --ff-only

.PHONY: build
build: ## Собрать образы
	@echo -e "  $(C)сборка образов$(N)"
	@$(COMPOSE) build

.PHONY: up
up: ## Запустить стек
	@echo -e "  $(C)запуск$(N)"
	@$(COMPOSE) up -d
	@$(MAKE) --no-print-directory wait

.PHONY: down
down: ## Остановить стек (данные сохраняются)
	@$(COMPOSE) down

.PHONY: restart
restart: ## Перезапустить стек
	@$(COMPOSE) restart

.PHONY: wait
wait: ## Дождаться готовности бэкенда
	@echo -n "  ждём бэкенд"
	@for i in $$(seq 1 60); do \
	  if docker exec parusa-backend python -c "import urllib.request;urllib.request.urlopen('http://localhost:8000/health',timeout=3)" >/dev/null 2>&1; then \
	    echo -e " $(G)готов$(N)"; exit 0; fi; \
	  echo -n "."; sleep 2; \
	done; echo -e " $(R)не дождались$(N) — смотрите make logs"; exit 1

.PHONY: ssl
ssl: ## Выпустить сертификаты Let's Encrypt для всех трёх доменов
	@bash deploy/ssl-issue.sh

.PHONY: nginx
nginx: ## Врезать домены в общий nginx и перечитать конфиг
	@bash deploy/nginx-apply.sh

.PHONY: ps
ps: ## Состояние контейнеров
	@$(COMPOSE) ps

.PHONY: logs
logs: ## Логи (S=имя сервиса, по умолчанию все)
	@$(COMPOSE) logs -f --tail=120 $(S)

.PHONY: urls
urls: ## Показать адреса проекта
	@set -a; . $(ENV_FILE); set +a; \
	echo ""; \
	echo -e "  сайт    $(C)https://$$SITE_DOMAIN$(N)"; \
	echo -e "  админка $(C)https://$$ADMIN_DOMAIN$(N)"; \
	echo -e "  API     $(C)https://$$API_DOMAIN/docs$(N)"; \
	echo ""

.PHONY: prune
prune: ## Убрать неиспользуемые образы (освобождает диск)
	@docker image prune -f >/dev/null && echo -e "  $(G)мусорные образы удалены$(N)"

# ─────────────────────────── Данные ───────────────────────────

.PHONY: backup
backup: db-backup media-backup ## Резервная копия базы и загруженных файлов

.PHONY: db-backup
db-backup: ## Дамп базы в backups/
	@mkdir -p $(BACKUP_DIR)
	@$(COMPOSE) exec -T postgres pg_dump -U $(DB_USER) $(DB_NAME) | gzip > $(BACKUP_DIR)/db-$(STAMP).sql.gz
	@echo -e "  $(G)база:$(N) $(BACKUP_DIR)/db-$(STAMP).sql.gz"

.PHONY: media-backup
media-backup: ## Архив загруженных файлов из хранилища
	@mkdir -p $(BACKUP_DIR)
	@docker run --rm -v parusa_miniodata:/data -v "$$PWD/$(BACKUP_DIR)":/out alpine \
	  tar czf /out/media-$(STAMP).tar.gz -C /data . 2>/dev/null
	@echo -e "  $(G)файлы:$(N) $(BACKUP_DIR)/media-$(STAMP).tar.gz"

.PHONY: db-restore
db-restore: ## Восстановить базу из дампа: make db-restore FILE=backups/db-….sql.gz
	@test -n "$(FILE)" || { echo -e "  $(R)укажите FILE=путь/к/дампу.sql.gz$(N)"; exit 1; }
	@test -f "$(FILE)" || { echo -e "  $(R)нет файла $(FILE)$(N)"; exit 1; }
	@echo -e "  $(Y)база будет перезаписана содержимым $(FILE)$(N)"
	@$(COMPOSE) stop backend >/dev/null
	@$(COMPOSE) exec -T postgres psql -U $(DB_USER) -d postgres -c \
	  "DROP DATABASE IF EXISTS $(DB_NAME); CREATE DATABASE $(DB_NAME) OWNER $(DB_USER);" >/dev/null
	@gunzip -c "$(FILE)" | $(COMPOSE) exec -T postgres psql -U $(DB_USER) -d $(DB_NAME) >/dev/null
	@$(COMPOSE) start backend >/dev/null
	@$(MAKE) --no-print-directory wait
	@echo -e "  $(G)база восстановлена$(N)"

.PHONY: db-shell
db-shell: ## Консоль psql
	@$(COMPOSE) exec postgres psql -U $(DB_USER) -d $(DB_NAME)

.PHONY: clean-test-data
clean-test-data: ## Удалить тестовые заявки из базы (боевая база должна быть чистой)
	@$(COMPOSE) exec -T postgres psql -U $(DB_USER) -d $(DB_NAME) -c "DELETE FROM leads;"
	@echo -e "  $(G)заявки очищены$(N)"

# ─────────────────────────── Локальная разработка ───────────────────────────

.PHONY: dev-up
dev-up: ## Локальный стек в докере (сайт :3000, админка :3001, API :8000)
	@docker compose up -d --build
	@echo -e "  сайт http://localhost:3000 · админка http://localhost:3001 · API http://localhost:8000/docs"

.PHONY: dev-down
dev-down: ## Остановить локальный стек
	@docker compose down

.PHONY: test
test: ## Прогнать все проверки: бэкенд, сайт, типы
	@echo -e "  $(C)бэкенд$(N)";  cd backend && pytest -q
	@echo -e "  $(C)сайт$(N)";    cd web && npm run typecheck && npm test
	@echo -e "  $(C)админка$(N)"; cd frontend-admin && npx tsc --noEmit
	@echo -e "  $(G)все проверки пройдены$(N)"
