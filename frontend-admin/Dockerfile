FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY . .

ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
# Адрес публичного сайта — ссылки «На сайте ↗» и «Открыть сайт».
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
# Демо-доступы на логине: «1» — показывать (локальное демо), пусто — нет (прод).
ARG NEXT_PUBLIC_SHOW_DEMO_CREDS=
ENV NEXT_PUBLIC_SHOW_DEMO_CREDS=$NEXT_PUBLIC_SHOW_DEMO_CREDS
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3001
CMD ["npm", "run", "start"]
