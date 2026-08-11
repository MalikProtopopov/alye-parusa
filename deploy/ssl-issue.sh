#!/usr/bin/env bash
# Выпускает сертификаты Let's Encrypt для доменов проекта.
#
# Использует certbot и тома общего nginx этого сервера: сертификаты кладутся
# туда же, откуда их читает nginx, а ACME-проверка проходит через уже
# работающий webroot. Свой веб-сервер поднимать не нужно и нельзя — порт 80
# занят общим nginx.
#
# Порядок важен: сначала nginx должен отдавать http-блок с
# /.well-known/acme-challenge/ (это делает nginx-apply.sh), и только потом
# запрашиваются сертификаты. make ssl вызывается после make nginx.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$HERE/.env.prod}"
if [ -f "$ENV_FILE" ]; then set -a; . "$ENV_FILE"; set +a; fi

CERT_VOLUME="${CERT_VOLUME:-client_certbot_certs}"
WEBROOT_VOLUME="${CERTBOT_WEBROOT_VOLUME:-client_certbot_webroot}"
EMAIL="${LETSENCRYPT_EMAIL:?не задан LETSENCRYPT_EMAIL}"
DOMAINS=("${SITE_DOMAIN:?}" "${ADMIN_DOMAIN:?}" "${API_DOMAIN:?}")

log() { printf '\033[36m▸ %s\033[0m\n' "$*"; }
warn() { printf '\033[33m! %s\033[0m\n' "$*"; }

has_cert() {
  docker run --rm -v "$CERT_VOLUME":/etc/letsencrypt alpine \
    test -f "/etc/letsencrypt/live/$1/fullchain.pem" >/dev/null 2>&1
}

# Проверка, что домен действительно указывает на этот сервер: без этого
# Let's Encrypt откажет и потратит попытку из недельного лимита.
MY_IP="$(curl -fsS --max-time 10 https://api.ipify.org 2>/dev/null || echo '')"

NEED=()
for d in "${DOMAINS[@]}"; do
  if has_cert "$d"; then
    log "$d — сертификат уже есть, пропускаю"
    continue
  fi
  ip="$(getent hosts "$d" | awk '{print $1}' | head -1)"
  if [ -n "$MY_IP" ] && [ -n "$ip" ] && [ "$ip" != "$MY_IP" ]; then
    warn "$d указывает на $ip, а сервер — $MY_IP. Пропускаю, иначе получим отказ."
    continue
  fi
  NEED+=("$d")
done

if [ ${#NEED[@]} -eq 0 ]; then
  log "новых сертификатов не требуется"
  exit 0
fi

# По отдельному сертификату на домен. Одним запросом certbot выпустил бы общий
# сертификат с именем первого домена, а nginx ищет файлы по пути
# live/<домен>/ — и для остальных доменов их бы просто не было.
for d in "${NEED[@]}"; do
  log "запрашиваю сертификат: $d"
  docker run --rm \
    -v "$CERT_VOLUME":/etc/letsencrypt \
    -v "$WEBROOT_VOLUME":/var/www/certbot \
    certbot/certbot certonly \
      --webroot -w /var/www/certbot \
      --cert-name "$d" -d "$d" \
      --email "$EMAIL" \
      --agree-tos --no-eff-email \
      --non-interactive \
      --keep-until-expiring || warn "не удалось выпустить для $d"
done

log "готово. Проверка:"
for d in "${DOMAINS[@]}"; do
  if has_cert "$d"; then printf '    ✓ %s\n' "$d"; else printf '    ✗ %s — сертификата нет\n' "$d"; fi
done

cat <<'NOTE'

Продление: сертификаты действуют 90 дней. Обновлять командой
    docker run --rm -v client_certbot_certs:/etc/letsencrypt \
      -v client_certbot_webroot:/var/www/certbot certbot/certbot renew \
      && docker exec client_nginx_prod nginx -s reload
Поставьте её в cron раз в неделю — см. docs/DEPLOY.md.
NOTE
