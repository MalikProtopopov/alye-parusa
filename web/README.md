# Алые Паруса — сайт (Next.js)

Продающий сайт апарт-комплекса «Алые Паруса» с **hero, привязанным к скроллу**: пустой берег превращается в готовый квартал по мере прокрутки (морф день→ночь), поверх — HTML-типографика по главам. Устройство слоёв и решений — [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).

## Стек
- **Next.js 15** (App Router, React 19, RSC) · TypeScript (strict)
- **GSAP ScrollTrigger** + **Lenis** — скролл-скраб и плавный скролл
- Canvas image-sequence — надёжный скраб (в т.ч. iOS/Safari)
- CSS Modules + design tokens (без UI-фреймворка)
- **Docker** (multi-stage, standalone) · Vitest (unit)

## Чистая архитектура (hexagonal)

Зависимости направлены только внутрь: `presentation → application → domain`, а `infrastructure` реализует порты приложения. Точка сборки — `composition`.

```
src/
├── domain/          Сущности, value-objects (ScrollRange), расчёт рассрочки
├── application/     Порты (репозитории) + use-cases → view-модели (DTO)
├── infrastructure/  api/ — адаптеры поверх CMS · content/ — статический фолбэк
├── composition/     container.ts — единственное место, где всё связывается
└── presentation/    React-компоненты, hero-скраб, секции, стили
app/                 Тонкий слой Next (layout/page композируют секции)
```

**Правило зависимостей:** `domain` не импортирует ничего; `application` знает только `domain`; `infrastructure` реализует интерфейсы `application`; `presentation` получает сериализуемые view-модели через `composition`.

**Два адаптера на каждый порт.** Контент приходит из CMS, но если API недоступен, списочные секции деградируют на статические данные из `src/infrastructure/content/data/*` — сайт остаётся живым, и прод-сборка проходит без запущенного бэкенда. Детальные страницы при этом отдают 5xx, а не 404: поисковик не должен принять аварию за удаление страницы.

## Медиа

Видео НЕ в git — они генерируются из исходников в `../materials/seedance-output`:

```bash
npm run prepare:media      # ffmpeg: морф→кадры, постер, фолбэк, пролёты, рендеры → public/media
```

Скрипт [`scripts/prepare-media.sh`](scripts/prepare-media.sh) собирает морф C1–C5 встык, режет на ~150 JPG-кадров (манифест — `public/media/hero/frames/manifest.json`), делает постер, облегчённый фолбэк-ролик, копирует пролёты с постерами и оптимизирует рендеры. Промежуточный `morph-full.mp4` кэшируется в `.media-cache/` (вне `public`). Тюнинг: `HERO_FPS`, `HERO_WIDTH`, `HERO_Q`.

Favicon-набор и OG-обложка коммитятся в репозиторий и пересобираются из `app/icon.svg` + hero-постера:

```bash
npm run prepare:icons      # sharp: favicon.ico, apple-icon, icons/192+512, og-cover.png
```

## Аналитика: цели Метрики

Счётчик Яндекс.Метрики запускается только после согласия на cookies (152-ФЗ), id приходит из CMS (`GET /analytics`). Цели шлются через [`src/presentation/lib/metrika.ts`](src/presentation/lib/metrika.ts) — до инициализации счётчика `reachGoal` молчит (no-op).

| Цель (идентификатор в Метрике) | Когда | Параметры |
| --- | --- | --- |
| `lead_submit` | Успешная отправка любой формы заявки (`LeadForm`) | `kind` (тип заявки), `source_block` (блок-источник) |

Новую цель добавлять так: константа в `METRIKA_GOALS` → вызов `reachGoal(...)` в компоненте → JS-цель с тем же идентификатором в интерфейсе Метрики.

## Запуск

```bash
npm install
npm run prepare:media      # один раз (нужен ffmpeg)
npm run dev                # http://localhost:3000

npm run typecheck          # tsc --noEmit
npm run test               # vitest
npm run build && npm start # прод-сборка
```

### Docker

```bash
docker compose up --build      # → http://localhost:3000
```

`public/media` попадает в образ, поэтому `npm run prepare:media` нужно выполнить **до** сборки образа (media генерятся на хосте из `../materials`, которых нет в docker-контексте `web/`).

## Как работает скраб (кратко)
- `Hero` (`src/presentation/components/hero/`) — высокая секция; `position: sticky` держит вьюпорт (визуальный «пин» без GSAP-pin → дружит с Lenis).
- `useScrollScrub` мапит прогресс ScrollTrigger в индекс кадра, рисует его на `<canvas>` (cover, DPR-cap), кадры грузятся прогрессивно.
- Главы-оверлеи меняют прозрачность по `chapterVisibility(progress, from, to)`.
- `prefers-reduced-motion` → статичный постер-hero без скраба.

## Доступность / перформанс
- Постер — LCP; кадры стримятся; пролёты играют только в зоне видимости.
- Тексты глав — реальные DOM-заголовки (SEO/скринридеры), canvas — `aria-hidden`.
- Reduced-motion отключает скролл-скраб, Lenis и автоплей.
