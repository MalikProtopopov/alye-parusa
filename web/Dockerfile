# syntax=docker/dockerfile:1
# Multi-stage build → minimal standalone runtime image.

# ── deps: install node_modules from a clean lockfile ──────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ── builder: compile the Next.js standalone server ────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
# API/site origins are baked into the client bundle at build time.
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
# Канонический origin сайта (canonical/OG/sitemap/robots) — задаётся явно,
# дефолта нет: сборка с фиктивным доменом отравила бы индекс поисковиков.
ARG NEXT_PUBLIC_SITE_URL
ARG API_URL=http://backend:8000
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    API_URL=$API_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN test -n "$NEXT_PUBLIC_SITE_URL" || (echo "ERROR: build arg NEXT_PUBLIC_SITE_URL is required" && exit 1)
RUN npm run build

# ── runner: only what is needed to serve ──────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# public assets (incl. prepared media) + standalone server + static chunks
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
