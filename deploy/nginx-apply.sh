#!/usr/bin/env bash
# Встраивает три домена «Алых Парусов» в ОБЩИЙ nginx сервера.
#
# На машине один монолитный nginx.conf, обслуживающий ещё несколько чужих
# проектов. Поэтому правим его хирургически: свой кусок держим между маркерами,
# остальное не трогаем. Перед записью — резервная копия, после — nginx -t;
# если конфиг не принят, откатываемся и выходим с ошибкой.
#
# Скрипт идемпотентен: повторный запуск переписывает только свой блок.
# https-блок добавляется лишь для тех доменов, у которых уже есть сертификат, —
# это разрывает замкнутый круг «нет сертификата → nginx не стартует → нечем
# пройти ACME-проверку».
#
# Запуск: make nginx   (переменные — из deploy/.env.prod)
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$HERE/.env.prod}"
if [ -f "$ENV_FILE" ]; then set -a; . "$ENV_FILE"; set +a; fi

NGINX_CONF="${NGINX_CONF:-/opt/mediannfront/nginx/nginx.conf}"
NGINX_CONTAINER="${NGINX_CONTAINER:-client_nginx_prod}"
CERT_VOLUME="${CERT_VOLUME:-client_certbot_certs}"
SITE_DOMAIN="${SITE_DOMAIN:?не задан SITE_DOMAIN}"
ADMIN_DOMAIN="${ADMIN_DOMAIN:?не задан ADMIN_DOMAIN}"
API_DOMAIN="${API_DOMAIN:?не задан API_DOMAIN}"

BEGIN="# >>> parusa (Алые Паруса) — управляется deploy/nginx-apply.sh, вручную не править"
END="# <<< parusa"

log() { printf '\033[36m▸ %s\033[0m\n' "$*"; }
die() { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[ -f "$NGINX_CONF" ] || die "не найден $NGINX_CONF"
docker inspect "$NGINX_CONTAINER" >/dev/null 2>&1 || die "нет контейнера $NGINX_CONTAINER"

has_cert() {
  docker run --rm -v "$CERT_VOLUME":/etc/letsencrypt alpine \
    test -f "/etc/letsencrypt/live/$1/fullchain.pem" >/dev/null 2>&1
}

# ── Генерация блоков ────────────────────────────────────────────────
http_block() {
  cat <<EOF

    server {
        listen 80;
        listen [::]:80;
        server_name $1;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
            allow all;
        }

        location / {
            return 301 https://\$host\$request_uri;
        }
    }
EOF
}

# $1 домен · $2 имя переменной апстрима · $3 host:port · $4 доп. location-блоки
https_block() {
  cat <<EOF

    server {
        listen 443 ssl;
        listen [::]:443 ssl;
        http2 on;
        server_name $1;

        ssl_certificate /etc/letsencrypt/live/$1/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/$1/privkey.pem;

        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        # Загрузка видео и чертежей из админки
        client_max_body_size 256m;
${4:-}
        location / {
            # апстрим через переменную: nginx резолвит его в рантайме и не
            # падает при старте, если наши контейнеры сейчас пересобираются
            set \$$2 $3;
            proxy_pass http://\$$2;
            proxy_http_version 1.1;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_read_timeout 120s;
        }
    }
EOF
}

SITE_EXTRA=$(cat <<'EOF'

        # Кадры первого экрана, загрузки из админки и иконки: имена содержат
        # хэш содержимого, поэтому кэшируем на год
        location ~* ^/(media|cms-media|icons)/ {
            set $parusa_static parusa-client:3000;
            proxy_pass http://$parusa_static;
            proxy_set_header Host $host;
            proxy_set_header X-Forwarded-Proto $scheme;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        location /_next/static/ {
            set $parusa_next parusa-client:3000;
            proxy_pass http://$parusa_next;
            proxy_set_header Host $host;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
EOF
)

SERVICE_EXTRA=$(cat <<'EOF'

        # Служебный хост — вне поисковых индексов
        add_header X-Robots-Tag "noindex, nofollow" always;

        location = /robots.txt {
            add_header Content-Type text/plain;
            return 200 "User-agent: *\nDisallow: /\n";
        }
EOF
)

build_config() {
  echo "$BEGIN"
  http_block "$SITE_DOMAIN"
  http_block "$ADMIN_DOMAIN"
  http_block "$API_DOMAIN"
  has_cert "$SITE_DOMAIN"  && https_block "$SITE_DOMAIN"  parusa_client  "parusa-client:3000"  "$SITE_EXTRA"
  has_cert "$ADMIN_DOMAIN" && https_block "$ADMIN_DOMAIN" parusa_admin   "parusa-admin:3001"   "$SERVICE_EXTRA"
  has_cert "$API_DOMAIN"   && https_block "$API_DOMAIN"   parusa_backend "parusa-backend:8000" "$SERVICE_EXTRA"
  echo "$END"
}

# ── Врезка ──────────────────────────────────────────────────────────
BACKUP="${NGINX_CONF}.bak-$(date +%Y%m%d-%H%M%S)"
cp "$NGINX_CONF" "$BACKUP"
log "резервная копия общего конфига: $BACKUP"

TMP="$(mktemp)"
build_config | python3 "$HERE/_nginx_merge.py" "$NGINX_CONF" "$TMP" "$BEGIN" "$END"
cp "$TMP" "$NGINX_CONF"
rm -f "$TMP"

log "проверяю конфиг"
if ! docker exec "$NGINX_CONTAINER" nginx -t 2>&1 | sed 's/^/    /'; then
  cp "$BACKUP" "$NGINX_CONF"
  docker exec "$NGINX_CONTAINER" nginx -s reload >/dev/null 2>&1 || true
  die "nginx отверг конфиг — вернул $BACKUP, на чужих проектах ничего не изменилось"
fi

docker exec "$NGINX_CONTAINER" nginx -s reload
log "nginx перечитал конфиг"

for d in "$SITE_DOMAIN" "$ADMIN_DOMAIN" "$API_DOMAIN"; do
  if has_cert "$d"; then printf '    ✓ %s — https\n' "$d"
  else printf '    · %s — пока только http, сертификата нет (выполните make ssl)\n' "$d"; fi
done
