// Конфигурация CRUD-разделов админки (config-driven).
// Один источник правды: поля формы + колонки списка + эндпоинт + подписи.
// Отрисовку выполняют универсальные компоненты ResourceForm / ResourceList,
// повторяя UX раздела «Планировки».

import type { ReactNode } from "react";
import type { FeatureFlags } from "./types";
import { apiFetch } from "./api";
import { SLUG_RE } from "./slug";
import { SECTION_ANCHORS, SITE } from "./site";
import { AVAILABILITY_LABELS, formatPrice } from "./labels";
import { parseDecimal } from "./validation";

export type FieldType =
  | "text"
  | "textarea"
  | "url"
  | "number"
  | "datetime"
  | "checkbox"
  | "select"
  | "media" // загрузка файла drag-n-drop (значение — строка URL)
  | "richtext" // WYSIWYG, значение — HTML-строка
  | "pagePicker"; // комбобокс путей сайта (datalist из /admin/seo-known-paths)

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean; // опция видна, но недоступна (занятый ключ, «не поддерживается»)
}

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  mono?: boolean;
  step?: string; // для number
  options?: SelectOption[]; // для select
  default?: string | boolean; // начальное значение
  accept?: "image" | "file"; // для media: только картинки или картинки+pdf
  noWidthWarning?: boolean; // для media: не предупреждать о ширине < 800px (логотипы/иконки)
  maxLength?: number; // мягкий лимит: счётчик символов, ввод не блокируется
  counter?: boolean; // показывать счётчик символов
  pattern?: RegExp; // клиентская проверка формата
  patternHint?: string; // текст ошибки при несовпадении pattern
  slugFrom?: string; // ключ поля-источника авто-слага (обычно "title")
  min?: number; // для number: нижняя граница (в единицах UI)
  max?: number; // для number: верхняя граница (в единицах UI)
  percent?: boolean; // UI показывает проценты (30), API хранит доли (0.30)
}

export type ColumnKind =
  | "text"
  | "mono"
  | "muted"
  | "bool"
  | "date"
  | "map"
  | "image" // миниатюра 48px
  | "toggle"; // inline-тумблер «активна» (оптимистичный PUT)

export interface ColumnDef {
  key: string;
  label: string;
  kind?: ColumnKind;
  primary?: boolean; // рендерится как ссылка на редактирование
  map?: Record<string, string>; // значение → подпись (для kind: "map")
  render?: (item: ResourceItem) => ReactNode; // произвольная ячейка
  // Вид бейджа для kind: "bool" — «Да» не всегда означает успех
  // (напр. noindex=Да — это предостережение, а не достижение)
  boolVariant?: "done" | "muted" | "warn";
}

export interface ResourceItem {
  id: string;
  [key: string]: unknown;
}

export interface ListBanner {
  kind: "info" | "warn";
  text: string;
}

export interface ResourceConfig {
  path: string; // сегмент API: news → /api/v1/admin/news
  route: string; // маршрут в админке: /news
  titlePlural: string; // заголовок списка
  description?: string; // что это и где выводится на сайте (под заголовком)
  newTitle: string; // заголовок формы создания
  editTitle: string; // заголовок формы редактирования
  nameField: string; // поле для подтверждений/тостов (title/name/…)
  fields: FieldDef[];
  columns: ColumnDef[];
  singleton?: boolean; // GET+PUT без списка (калькулятор)
  singletonTitle?: string;
  feature?: keyof FeatureFlags; // фичефлаг для показа в меню
  /** Адрес записи на сайте — иконка «Открыть на сайте» в строке списка
   *  (null — не показывать). */
  siteHref?: (item: ResourceItem) => string | null;
  /** DnD-сортировка списка + POST /admin/{path}/reorder. */
  reorderable?: boolean;
  /** Ключи поиска в списке (по умолчанию [nameField, "slug"]). */
  searchKeys?: string[];
  /** Чипы-фильтры по полю-группе («Все | Группа (n)»). */
  groupBy?: { key: string; options: SelectOption[] };
  /** Максимум активных записей (главы hero — 6). */
  maxActive?: number;
  /** Баннер над списком (нет активной Политики, «6 из 6» и т.п.). */
  listBanner?: (items: ResourceItem[]) => ListBanner | null;
  /** Доп. текст confirm при удалении (null — стандартный confirm). */
  confirmDelete?: (item: ResourceItem, items: ResourceItem[]) => string | null;
  /** Текст тоста тумблера «активен» (по умолчанию «Запись включена» /
      «Запись скрыта с сайта» — для редиректов формулировка своя). */
  toggleToast?: (next: boolean) => string;
  /** Доп. текст confirm при переключении тумблера (null — без confirm). */
  confirmToggle?: (
    item: ResourceItem,
    next: boolean,
    items: ResourceItem[]
  ) => string | null;
  /** Асинхронный confirm перед сохранением (перенос пометки «Политика»). */
  confirmSave?: (
    payload: Record<string, unknown>,
    ctx: { id?: string; isEdit: boolean }
  ) => Promise<string | null>;
  /** Кросс-полевая валидация формы: map «ключ поля → текст ошибки». */
  validate?: (
    form: Record<string, string | boolean>
  ) => Record<string, string>;
}

// Общая подсказка для полей-изображений.
export const IMAGE_HINT =
  "JPG/PNG/WebP/GIF до 10 МБ; рекомендуем от 1200 px по ширине";

// Подсказка формата слага (единая для всех разделов).
const SLUG_PATTERN_HINT = "Только латиница, цифры и дефис, напр. moya-stranica";

// Поле «Адрес (slug)»: авто-транслит из title, проверка формата.
function slugFieldDef(hint: string, placeholder: string): FieldDef {
  return {
    key: "slug",
    label: "Адрес (slug)",
    type: "text",
    required: true,
    mono: true,
    placeholder,
    hint,
    pattern: SLUG_RE,
    patternHint: SLUG_PATTERN_HINT,
    slugFrom: "title",
  };
}

// Переиспользуемые поля/колонки «активна» и «порядок».
const ACTIVE_FIELD: FieldDef = {
  key: "active",
  label: "Активна (показывать на сайте)",
  type: "checkbox",
  default: true,
  hint: "Выключено — запись скрыта на сайте, данные сохраняются",
};
const SORT_FIELD: FieldDef = {
  key: "sort",
  label: "Порядок",
  type: "number",
  step: "1",
  default: "0",
  hint: "Порядок вывода: меньше — выше. Удобнее перетаскивать строки в списке",
};
const ACTIVE_COL: ColumnDef = {
  key: "active",
  label: "Активна",
  kind: "toggle",
};
const SORT_COL: ColumnDef = { key: "sort", label: "Порядок", kind: "muted" };

export const DOC_TYPE_OPTIONS: SelectOption[] = [
  { value: "permit", label: "Разрешение на строительство" },
  { value: "declaration", label: "Проектная декларация" },
  { value: "policy", label: "Политика / согласие" },
  { value: "link", label: "Ссылка" },
  { value: "other", label: "Другое" },
];

const DOC_TYPE_MAP: Record<string, string> = Object.fromEntries(
  DOC_TYPE_OPTIONS.map((o) => [o.value, o.label])
);

// ── 1. Новости ──────────────────────────────────────────────────────
export const newsConfig: ResourceConfig = {
  path: "news",
  route: "/news",
  titlePlural: "Новости",
  description:
    "Отдельные страницы /novosti/<slug> и лента новостей на главной странице сайта.",
  newTitle: "Новая новость",
  editTitle: "Редактирование новости",
  nameField: "title",
  feature: "news",
  siteHref: (item) => (item.slug ? `${SITE}/novosti/${item.slug}` : null),
  reorderable: true,
  // У новости есть публичная страница — предупреждаем, что она пропадёт.
  confirmDelete: (item) =>
    item.slug
      ? `Удалить новость «${String(item.title ?? "")}»? Её страница /novosti/${String(
          item.slug
        )} перестанет открываться (посетители получат 404). Действие необратимо.`
      : null,
  fields: [
    {
      key: "title",
      label: "Заголовок",
      type: "text",
      required: true,
      hint: "Выводится в ленте и как H1 на странице новости",
    },
    slugFieldDef(
      "Часть адреса страницы /novosti/<slug> — заполняется сам из заголовка",
      "otkrytie-prodazh"
    ),
    {
      key: "excerpt",
      label: "Краткое описание",
      type: "textarea",
      hint: "Анонс в 1–2 предложения — показывается в ленте вместо полного текста",
    },
    { key: "body", label: "Текст", type: "richtext" },
    {
      key: "cover_image_url",
      label: "Обложка",
      type: "media",
      accept: "image",
      hint: IMAGE_HINT,
    },
    {
      key: "published_at",
      label: "Дата публикации",
      type: "datetime",
      hint: "Дата публикации для сортировки и вывода; пустая — новость без даты",
    },
    ACTIVE_FIELD,
    SORT_FIELD,
  ],
  columns: [
    { key: "title", label: "Заголовок", primary: true },
    { key: "slug", label: "Адрес", kind: "mono" },
    { key: "published_at", label: "Публикация", kind: "date" },
    ACTIVE_COL,
    SORT_COL,
  ],
};

// ── 2. FAQ ──────────────────────────────────────────────────────────
export const faqConfig: ResourceConfig = {
  path: "faq",
  route: "/faq",
  titlePlural: "FAQ",
  description: "Блок «Вопрос — ответ» на главной странице сайта.",
  newTitle: "Новый вопрос",
  editTitle: "Редактирование вопроса",
  nameField: "question",
  feature: "faq",
  siteHref: () => `${SITE}/#faq`,
  reorderable: true,
  fields: [
    {
      key: "question",
      label: "Вопрос",
      type: "text",
      required: true,
      hint: "Формулировка так, как её видит посетитель сайта",
    },
    {
      key: "answer",
      label: "Ответ",
      type: "richtext",
      required: true,
    },
    ACTIVE_FIELD,
    SORT_FIELD,
  ],
  columns: [
    { key: "question", label: "Вопрос", primary: true },
    ACTIVE_COL,
    SORT_COL,
  ],
};

// ── 3. Преимущества ─────────────────────────────────────────────────
export const ADVANTAGE_CATEGORY_OPTIONS: SelectOption[] = [
  { value: "living", label: "Жизнь" },
  { value: "leisure", label: "Отдых и курорт" },
  { value: "infrastructure", label: "Инфраструктура" },
];

const ADVANTAGE_CATEGORY_MAP: Record<string, string> = Object.fromEntries(
  ADVANTAGE_CATEGORY_OPTIONS.map((o) => [o.value, o.label])
);

export const advantagesConfig: ResourceConfig = {
  path: "advantages",
  route: "/advantages",
  titlePlural: "Преимущества",
  description: "Карточки блока «Преимущества» на главной странице.",
  newTitle: "Новое преимущество",
  editTitle: "Редактирование преимущества",
  nameField: "title",
  feature: "advantages",
  siteHref: () => `${SITE}/#about`,
  reorderable: true,
  fields: [
    {
      key: "title",
      label: "Заголовок",
      type: "text",
      required: true,
      hint: "Короткая формулировка выгоды, 2–4 слова",
    },
    {
      key: "category",
      label: "Категория",
      type: "select",
      options: ADVANTAGE_CATEGORY_OPTIONS,
      default: "living",
      hint: "Группа карточки в блоке «Преимущества» на сайте",
    },
    {
      key: "text",
      label: "Текст",
      type: "richtext",
    },
    {
      key: "image_url",
      label: "Изображение / иконка",
      type: "media",
      accept: "image",
      noWidthWarning: true,
      hint: "JPG/PNG/WebP/GIF до 10 МБ. Для иконок подойдёт небольшой PNG",
    },
    ACTIVE_FIELD,
    SORT_FIELD,
  ],
  columns: [
    { key: "title", label: "Заголовок", primary: true },
    {
      key: "category",
      label: "Категория",
      kind: "map",
      map: ADVANTAGE_CATEGORY_MAP,
    },
    ACTIVE_COL,
    SORT_COL,
  ],
};

// ── 4. Партнёры ─────────────────────────────────────────────────────
export const partnersConfig: ResourceConfig = {
  path: "partners",
  route: "/partners",
  titlePlural: "Партнёры",
  description: "Логотипы и ссылки партнёров проекта — блок на главной странице.",
  newTitle: "Новый партнёр",
  editTitle: "Редактирование партнёра",
  nameField: "name",
  feature: "partners",
  siteHref: () => `${SITE}/#partners`,
  reorderable: true,
  fields: [
    {
      key: "name",
      label: "Название",
      type: "text",
      required: true,
      hint: "Название компании — показывается, если логотип не загружен",
    },
    {
      key: "logo_url",
      label: "Логотип",
      type: "media",
      accept: "image",
      noWidthWarning: true,
      hint: "PNG/WebP с прозрачным фоном до 10 МБ; логотип не растягивается",
    },
    {
      key: "url",
      label: "Ссылка на сайт",
      type: "url",
      placeholder: "https://…",
      pattern: /^https?:\/\/\S+$/i,
      patternHint: "Укажите полный адрес с https://, напр. https://sberbank.ru",
      hint: "Полный адрес с https:// — открывается по клику на логотип",
    },
    {
      key: "description",
      label: "Описание",
      type: "textarea",
      hint: "Кем является партнёр в проекте: банк, УК, застройщик…",
    },
    ACTIVE_FIELD,
    SORT_FIELD,
  ],
  columns: [
    { key: "name", label: "Название", primary: true },
    { key: "url", label: "Сайт", kind: "muted" },
    ACTIVE_COL,
    SORT_COL,
  ],
};

// ── 5. Команда ──────────────────────────────────────────────────────
export const teamConfig: ResourceConfig = {
  path: "team",
  route: "/team",
  titlePlural: "Команда",
  description: "Блок «Команда проекта» на главной странице сайта.",
  newTitle: "Новый сотрудник",
  editTitle: "Редактирование сотрудника",
  nameField: "name",
  feature: "team",
  siteHref: () => `${SITE}/#team`,
  reorderable: true,
  fields: [
    { key: "name", label: "Имя", type: "text", required: true },
    {
      key: "role",
      label: "Должность",
      type: "text",
      hint: "Выводится под именем в карточке сотрудника",
    },
    {
      key: "photo_url",
      label: "Фото",
      type: "media",
      accept: "image",
      hint: "Портрет JPG/PNG/WebP до 10 МБ; лучше квадратное фото от 800 px",
    },
    {
      key: "bio",
      label: "Биография",
      type: "textarea",
      hint: "Пара предложений об опыте — раскрывается в карточке",
    },
    ACTIVE_FIELD,
    SORT_FIELD,
  ],
  columns: [
    { key: "name", label: "Имя", primary: true },
    { key: "role", label: "Должность", kind: "text" },
    ACTIVE_COL,
    SORT_COL,
  ],
};

// ── 6. Документы ────────────────────────────────────────────────────
export const documentsConfig: ResourceConfig = {
  path: "documents",
  route: "/documents",
  titlePlural: "Документы",
  description:
    "Раздел «Документы» на сайте: разрешения, декларации, политика обработки ПДн.",
  newTitle: "Новый документ",
  editTitle: "Редактирование документа",
  nameField: "title",
  feature: "documents",
  siteHref: (item) => (item.slug ? `${SITE}/dokumenty/${item.slug}` : null),
  reorderable: true,
  // У документа есть публичная страница; для Политики — отдельное последствие.
  confirmDelete: (item) => {
    const title = String(item.title ?? "");
    const page = item.slug
      ? ` Его страница /dokumenty/${String(item.slug)} перестанет открываться.`
      : "";
    const policy = item.is_policy
      ? " Это Политика конфиденциальности — согласия у форм сайта останутся без ссылки (152-ФЗ)."
      : "";
    return page || policy
      ? `Удалить документ «${title}»?${page}${policy} Действие необратимо.`
      : null;
  },
  listBanner: (items) =>
    items.some((d) => Boolean(d.is_policy) && Boolean(d.active))
      ? null
      : {
          kind: "warn",
          text: "Нет активной Политики конфиденциальности — согласия у форм на сайте ссылаются в пустоту (152-ФЗ). Отметьте документ галкой «Это Политика» и включите его.",
        },
  confirmSave: async (payload, ctx) => {
    if (!payload.is_policy) return null;
    try {
      // on401: "silent" — форма с данными смонтирована, увод на /login стёр бы
      // всё набранное (проверка идёт ДО сохранения)
      const docs = await apiFetch<ResourceItem[]>("/api/v1/admin/documents", {
        on401: "silent",
      });
      const other = docs.find(
        (d) => Boolean(d.is_policy) && d.id !== ctx.id
      );
      if (other) {
        return `Политика сейчас — «${String(other.title ?? "")}». Перенести пометку «Политика» на этот документ? Формы сайта начнут ссылаться на него.`;
      }
    } catch {
      /* бэкенд недоступен — не блокируем сохранение */
    }
    return null;
  },
  fields: [
    {
      key: "title",
      label: "Название",
      type: "text",
      required: true,
      hint: "Как документ подписан в списке на сайте",
    },
    slugFieldDef(
      "Часть адреса страницы /dokumenty/<slug> — заполняется сам из названия",
      "proektnaya-deklaraciya"
    ),
    {
      key: "doc_type",
      label: "Тип документа",
      type: "select",
      options: DOC_TYPE_OPTIONS,
      default: "permit",
      hint: "Группирует документы в разделе на сайте",
    },
    {
      key: "description",
      label: "Аннотация",
      type: "richtext",
      hint: "Короткое пояснение, зачем нужен документ — выводится на странице «Документы» сайта",
    },
    {
      key: "file_url",
      label: "Файл",
      type: "media",
      accept: "file",
      hint: "PDF или изображение до 10 МБ. Если файл на другом сайте — заполните «Внешняя ссылка»",
    },
    {
      key: "url",
      label: "Внешняя ссылка",
      type: "url",
      placeholder: "https://…",
      pattern: /^https?:\/\/\S+$/i,
      patternHint: "Укажите полный адрес с https://, напр. https://example.ru",
      hint: "Используется вместо файла, если документ размещён на внешнем ресурсе",
    },
    {
      key: "is_policy",
      label: "Это Политика конфиденциальности",
      type: "checkbox",
      hint: "Ровно один документ — Политика: на него ссылается чекбокс согласия у форм на сайте",
      default: false,
    },
    ACTIVE_FIELD,
    SORT_FIELD,
  ],
  columns: [
    { key: "title", label: "Название", primary: true },
    { key: "slug", label: "Адрес", kind: "mono" },
    { key: "doc_type", label: "Тип", kind: "map", map: DOC_TYPE_MAP },
    { key: "is_policy", label: "Политика", kind: "bool" },
    ACTIVE_COL,
    SORT_COL,
  ],
};

// ── 7. Категории планировок ─────────────────────────────────────────
// Число планировок в категории (floorplans_count отдаёт бэкенд).
function categoryPlansCount(item: ResourceItem): number {
  return typeof item.floorplans_count === "number" ? item.floorplans_count : 0;
}

export const planCategoriesConfig: ResourceConfig = {
  path: "plan-categories",
  route: "/plan-categories",
  titlePlural: "Категории планировок",
  description:
    "Группы каталога: студии, 1-комнатные… Фильтр-чипы на /planirovki и ЧПУ-адреса /planirovki/<slug>.",
  newTitle: "Новая категория",
  editTitle: "Редактирование категории",
  nameField: "title",
  siteHref: (item) => (item.slug ? `${SITE}/planirovki/${item.slug}` : null),
  reorderable: true,
  confirmDelete: (item) => {
    const n = categoryPlansCount(item);
    return n > 0
      ? `В категории «${String(item.title ?? "")}» — планировок: ${n}. Они останутся без категории и выпадут из фильтров каталога. Удалить категорию?`
      : null;
  },
  confirmToggle: (item, next) => {
    const n = categoryPlansCount(item);
    return !next && n > 0
      ? `В категории «${String(item.title ?? "")}» — планировок: ${n}. При выключении категория и её страница пропадут с сайта. Выключить?`
      : null;
  },
  fields: [
    {
      key: "title",
      label: "Название",
      type: "text",
      required: true,
      hint: "Как категория подписана в фильтре каталога, напр. «Студии»",
    },
    slugFieldDef(
      "Часть адреса /planirovki/<slug> — заполняется сам из названия",
      "studii"
    ),
    {
      key: "description",
      label: "Описание категории",
      type: "richtext",
      hint: "Абзац-два о категории — выводится на её странице /planirovki/<slug> и помогает продвижению в поиске",
    },
    ACTIVE_FIELD,
    SORT_FIELD,
  ],
  columns: [
    { key: "title", label: "Название", primary: true },
    { key: "slug", label: "Адрес", kind: "mono" },
    {
      key: "floorplans_count",
      label: "Планировок",
      kind: "muted",
      render: (item) => String(categoryPlansCount(item)),
    },
    ACTIVE_COL,
    SORT_COL,
  ],
};

// ── 8. Факты ────────────────────────────────────────────────────────
export const FACT_GROUP_OPTIONS: SelectOption[] = [
  { value: "about", label: "О комплексе (цифры проекта)" },
  { value: "trust", label: "Доверие (эскроу, застройщик)" },
  { value: "nearby", label: "Рядом (минуты пешком)" },
  { value: "investment", label: "Инвестиции (метрики)" },
];

const FACT_GROUP_MAP: Record<string, string> = Object.fromEntries(
  FACT_GROUP_OPTIONS.map((o) => [o.value, o.label])
);

export const factsConfig: ResourceConfig = {
  path: "facts",
  route: "/facts",
  titlePlural: "Факты",
  description:
    "Цифры и чипы главной страницы: «О комплексе», лента «Надёжность», «Всё рядом», метрики «Инвестиций».",
  newTitle: "Новый факт",
  editTitle: "Редактирование факта",
  nameField: "label",
  siteHref: () => `${SITE}/#about`,
  reorderable: true,
  groupBy: { key: "group", options: FACT_GROUP_OPTIONS },
  fields: [
    {
      key: "group",
      label: "Группа",
      type: "select",
      options: FACT_GROUP_OPTIONS,
      default: "about",
      hint: "В какой блок главной страницы попадает факт",
    },
    {
      key: "label",
      label: "Подпись",
      type: "text",
      required: true,
      hint: "Что за факт, напр. «Школа»",
    },
    {
      key: "value",
      label: "Значение",
      type: "text",
      required: true,
      hint: "Само значение, напр. «8 минут»",
    },
    {
      key: "note",
      label: "Примечание",
      type: "text",
      hint: "Необязательная мелкая строка под фактом",
    },
    ACTIVE_FIELD,
    SORT_FIELD,
  ],
  columns: [
    { key: "label", label: "Подпись", primary: true },
    { key: "value", label: "Значение", kind: "text" },
    { key: "group", label: "Группа", kind: "map", map: FACT_GROUP_MAP },
    ACTIVE_COL,
    SORT_COL,
  ],
};

// ── 9. Тексты секций ────────────────────────────────────────────────
export const SECTION_KEY_OPTIONS: SelectOption[] = [
  { value: "identity", label: "Шапка/подвал (вордмарк)" },
  { value: "about", label: "О комплексе" },
  { value: "trust_band", label: "Лента «Надёжность»" },
  { value: "location", label: "Локация" },
  { value: "nearby_band", label: "Лента «Всё рядом»" },
  { value: "infrastructure", label: "Инфраструктура" },
  { value: "scroll_story", label: "Жизнь у моря (скролл-история)" },
  { value: "residences", label: "Апартаменты" },
  { value: "investment", label: "Инвестиции" },
  { value: "cta", label: "Финальный призыв" },
  { value: "floorplans", label: "Блок планировок" },
  { value: "calculator", label: "Блок калькулятора" },
  { value: "news", label: "Блок новостей" },
  { value: "team", label: "Блок команды" },
  { value: "faq", label: "Блок FAQ" },
  { value: "partners", label: "Блок партнёров" },
];

const SECTION_KEY_MAP: Record<string, string> = Object.fromEntries(
  SECTION_KEY_OPTIONS.map((o) => [o.value, o.label])
);

export const siteTextsConfig: ResourceConfig = {
  path: "site-texts",
  route: "/site-texts",
  titlePlural: "Тексты секций",
  description:
    "Надзаголовок, заголовок и лид каждой секции главной страницы. Ключ определяет, какой секции принадлежит текст.",
  newTitle: "Новый текст секции",
  editTitle: "Редактирование текста секции",
  nameField: "title",
  siteHref: (item) =>
    `${SITE}${SECTION_ANCHORS[String(item.key ?? "")] ?? "/"}`,
  fields: [
    {
      key: "key",
      label: "Секция (ключ)",
      type: "select",
      options: SECTION_KEY_OPTIONS,
      default: "about",
      hint: "Секция сайта, куда подставляется текст; на каждый ключ — одна запись",
    },
    {
      key: "eyebrow",
      label: "Надзаголовок (eyebrow)",
      type: "text",
      hint: "Мелкая строка капсом над заголовком секции",
    },
    {
      key: "title",
      label: "Заголовок",
      type: "text",
      required: true,
    },
    {
      key: "lead",
      label: "Подводка (текст под заголовком)",
      type: "textarea",
      hint: "1–2 предложения под заголовком секции",
    },
  ],
  columns: [
    { key: "key", label: "Секция", primary: true, kind: "map", map: SECTION_KEY_MAP },
    { key: "title", label: "Заголовок", kind: "text" },
  ],
};

// ── 10. Главы hero ──────────────────────────────────────────────────
export const heroChaptersConfig: ResourceConfig = {
  path: "hero-chapters",
  route: "/hero-chapters",
  titlePlural: "Главы hero",
  description:
    "6 текстовых глав скролл-hero главной страницы: тексты сменяются по мере прокрутки видеосеквенции.",
  newTitle: "Новая глава",
  editTitle: "Редактирование главы",
  nameField: "title",
  siteHref: () => SITE,
  reorderable: true,
  maxActive: 6,
  listBanner: (items) => {
    const n = items.filter((x) => Boolean(x.active)).length;
    return n === 6
      ? {
          kind: "info",
          text: "Активно 6 из 6 — сайт показывает тексты глав из CMS.",
        }
      : {
          kind: "warn",
          text: `Активных глав: ${n} из 6 — сайт показывает стандартные тексты. Для текстов из CMS должно быть активно ровно 6 глав.`,
        };
  },
  confirmToggle: (item, next, items) => {
    const n = items.filter((x) => Boolean(x.active)).length;
    if (!next && n === 6) {
      return `Выключить главу «${String(item.title ?? "")}»? Активных станет 5 из 6 — сайт вернётся к стандартным текстам hero.`;
    }
    if (next && n >= 6) {
      return `Активных глав уже 6 из 6. Включить ещё одну? Сайт использует ровно 6 — при 7 активных вернётся к стандартным текстам.`;
    }
    return null;
  },
  confirmDelete: (item, items) => {
    const n = items.filter((x) => Boolean(x.active)).length;
    return Boolean(item.active) && n === 6
      ? `Удалить главу «${String(item.title ?? "")}»? Активных останется 5 из 6 — сайт вернётся к стандартным текстам hero.`
      : null;
  },
  fields: [
    {
      key: "eyebrow",
      label: "Надзаголовок (eyebrow)",
      type: "text",
      hint: "Мелкая строка капсом над заголовком главы",
    },
    {
      key: "title",
      label: "Заголовок",
      type: "text",
      required: true,
    },
    {
      key: "subtitle",
      label: "Подзаголовок",
      type: "textarea",
      hint: "1–2 предложения под заголовком главы",
    },
    ACTIVE_FIELD,
    SORT_FIELD,
  ],
  columns: [
    { key: "title", label: "Заголовок", primary: true },
    { key: "eyebrow", label: "Надзаголовок", kind: "muted" },
    ACTIVE_COL,
    SORT_COL,
  ],
};

// ── 11. Калькулятор рассрочки (singleton: GET + PUT) ────────────────
export const calculatorConfig: ResourceConfig = {
  path: "calculator",
  route: "/calculator",
  titlePlural: "Калькулятор рассрочки",
  description:
    "Параметры рассрочки на сайте: первый взнос, срок и удорожание. Меняются сразу для всех посетителей.",
  singletonTitle: "Калькулятор рассрочки",
  newTitle: "",
  editTitle: "",
  nameField: "",
  singleton: true,
  feature: "calculator",
  validate: (form) => {
    const errors: Record<string, string> = {};
    // parseDecimal, а не Number(): поля принимают «8,5» и «5 000 000»,
    // иначе кросс-проверки молча пропускали бы такие значения
    const num = (key: string): number | null => {
      const s = String(form[key] ?? "").trim();
      if (s === "") return null;
      const n = parseDecimal(s);
      return Number.isNaN(n) ? null : n;
    };
    const min = num("min_down_payment_pct");
    const max = num("max_down_payment_pct");
    if (min !== null && max !== null && min > max) {
      errors.min_down_payment_pct =
        "Минимальный первый взнос больше максимального";
    }
    const tmin = num("term_min_months");
    const tmax = num("term_max_months");
    if (tmin !== null && tmax !== null && tmin > tmax) {
      errors.term_min_months = "Минимальный срок больше максимального";
    }
    const step = num("term_step_months");
    if (step !== null && step < 1) {
      errors.term_step_months = "Шаг срока — не меньше 1 месяца";
    }
    return errors;
  },
  fields: [
    {
      key: "price_per_m2",
      label: "Цена за м², ₽",
      type: "number",
      step: "1",
      min: 0,
      hint: "Резервная цена метра: из неё считается стоимость лота без своей цены",
    },
    {
      key: "min_down_payment_pct",
      required: true,
      label: "Мин. первый взнос, %",
      type: "number",
      step: "1",
      min: 0,
      max: 100,
      percent: true,
      hint: "Процент от стоимости: 30 = 30 %",
    },
    {
      key: "max_down_payment_pct",
      required: true,
      label: "Макс. первый взнос, %",
      type: "number",
      step: "1",
      min: 0,
      max: 100,
      percent: true,
      hint: "Процент от стоимости: 90 = 90 %",
    },
    {
      key: "term_min_months",
      required: true,
      label: "Мин. срок, мес.",
      type: "number",
      step: "1",
      min: 1,
      hint: "Нижняя граница слайдера срока на сайте",
    },
    {
      key: "term_max_months",
      required: true,
      label: "Макс. срок, мес.",
      type: "number",
      step: "1",
      min: 1,
      hint: "Верхняя граница слайдера срока на сайте",
    },
    {
      key: "term_step_months",
      required: true,
      label: "Шаг срока, мес.",
      type: "number",
      step: "1",
      min: 1,
      hint: "Шаг слайдера срока на сайте, напр. 6",
    },
    {
      key: "markup_pct_annual",
      required: true,
      label: "Удорожание, % годовых",
      type: "number",
      step: "0.1",
      min: 0,
      max: 100,
      percent: true,
      hint: "0 — беспроцентная рассрочка; 8 = удорожание 8 % годовых",
    },
    {
      key: "disclaimer",
      label: "Дисклеймер",
      type: "textarea",
      hint: "Юридическая оговорка мелким шрифтом под калькулятором: «не является офертой…»",
    },
  ],
  columns: [],
};

// ── 12. SEO ─────────────────────────────────────────────────────────
export const seoConfig: ResourceConfig = {
  path: "seo",
  route: "/seo",
  titlePlural: "SEO",
  description:
    "Title, description и OG-разметка страниц сайта — для поисковиков и шаринга в соцсетях.",
  newTitle: "Новая SEO-запись",
  editTitle: "Редактирование SEO",
  nameField: "slug",
  feature: "seo_admin",
  siteHref: (item) => {
    const slug = String(item.slug ?? "");
    return slug.startsWith("/") ? `${SITE}${slug}` : null;
  },
  fields: [
    {
      key: "slug",
      label: "Страница",
      type: "pagePicker",
      required: true,
      mono: true,
      placeholder: "/planirovki",
      pattern: /^\//,
      patternHint: "Путь должен начинаться с «/»",
      hint: "Путь страницы сайта: выберите из списка или введите вручную, напр. «/» (главная) или «/planirovki»",
    },
    {
      key: "title",
      label: "Title",
      type: "text",
      maxLength: 60,
      counter: true,
      hint: "Заголовок вкладки и сниппета в поиске; оптимально до 60 символов",
    },
    {
      key: "description",
      label: "Description",
      type: "textarea",
      maxLength: 160,
      counter: true,
      hint: "Описание в поисковой выдаче; оптимально до 160 символов",
    },
    {
      key: "og_image_url",
      label: "OG-изображение",
      type: "media",
      accept: "image",
      hint: "Картинка при шаринге ссылки в соцсетях и мессенджерах; рекомендуем 1200×630",
    },
    {
      key: "noindex",
      label: "Скрыть страницу из поиска и sitemap",
      type: "checkbox",
      default: false,
      hint: "Страница остаётся доступной по ссылке, но поисковики её не индексируют",
    },
  ],
  columns: [
    { key: "slug", label: "Страница", primary: true, kind: "mono" },
    { key: "title", label: "Title", kind: "text" },
    { key: "noindex", label: "Noindex", kind: "bool" },
  ],
};

// ── 13. Редиректы ───────────────────────────────────────────────────
const PATH_PATTERN = /^\//;
const PATH_PATTERN_HINT = "Путь должен начинаться с «/»";

export const redirectsConfig: ResourceConfig = {
  path: "redirects",
  route: "/redirects",
  titlePlural: "Редиректы",
  description:
    "301-перенаправления со старых адресов на новые. Создаются автоматически при смене адреса записи; можно добавлять и вручную.",
  newTitle: "Новый редирект",
  editTitle: "Редактирование редиректа",
  nameField: "from_path",
  // Редирект — не «запись на сайте»: тумблер говорит о срабатывании 301.
  toggleToast: (next) =>
    next
      ? "Редирект включён — переход со старого адреса работает"
      : "Редирект выключен — переход со старого адреса не выполняется",
  validate: (form) => {
    const errors: Record<string, string> = {};
    const from = String(form.from_path ?? "").trim();
    const to = String(form.to_path ?? "").trim();
    if (from && to && from === to) {
      errors.to_path = "Адреса «откуда» и «куда» совпадают";
    }
    return errors;
  },
  fields: [
    {
      key: "from_path",
      label: "Откуда",
      type: "text",
      required: true,
      mono: true,
      placeholder: "/novosti/staryj-adres",
      pattern: PATH_PATTERN,
      patternHint: PATH_PATTERN_HINT,
      hint: "Старый путь на сайте — с него посетитель уходит по 301",
    },
    {
      key: "to_path",
      label: "Куда",
      type: "text",
      required: true,
      mono: true,
      placeholder: "/novosti/novyj-adres",
      pattern: PATH_PATTERN,
      patternHint: PATH_PATTERN_HINT,
      hint: "Новый путь, на который ведёт редирект",
    },
    {
      key: "note",
      label: "Заметка",
      type: "text",
      hint: "Зачем нужен редирект — видно только в админке",
    },
    {
      key: "active",
      label: "Активен",
      type: "checkbox",
      default: true,
      hint: "Выключено — редирект не срабатывает, запись сохраняется",
    },
  ],
  columns: [
    { key: "from_path", label: "Откуда", primary: true, kind: "mono" },
    { key: "to_path", label: "Куда", kind: "mono" },
    { key: "note", label: "Заметка", kind: "muted" },
    { key: "active", label: "Активен", kind: "toggle" },
  ],
};

// ── 14. Планировки: конфиг списка (форма — своя, FloorplanForm) ─────
export const floorplansListConfig: ResourceConfig = {
  path: "floorplans",
  route: "/floorplans",
  titlePlural: "Планировки",
  description:
    "Каталог лотов: страница /planirovki и карточки планировок на главной.",
  newTitle: "Новая планировка",
  editTitle: "Редактирование планировки",
  nameField: "title",
  siteHref: (item) => (item.slug ? `${SITE}/planirovki/${item.slug}` : null),
  reorderable: true,
  searchKeys: ["title", "slug"],
  // У планировки есть публичная страница — предупреждаем, что она пропадёт.
  confirmDelete: (item) =>
    item.slug
      ? `Удалить планировку «${String(item.title ?? "")}»? Её страница /planirovki/${String(
          item.slug
        )} перестанет открываться (посетители получат 404). Действие необратимо.`
      : null,
  fields: [], // форма — FloorplanForm.tsx
  columns: [
    { key: "image_url", label: "Фото", kind: "image" },
    { key: "title", label: "Название", primary: true },
    {
      key: "category",
      label: "Категория",
      render: (item) => {
        const cat = item.category as { title?: string } | null;
        return cat?.title ?? "—";
      },
    },
    {
      key: "area_m2",
      label: "Площадь",
      render: (item) =>
        typeof item.area_m2 === "number" ? `${item.area_m2} м²` : "—",
    },
    {
      key: "price",
      label: "Цена",
      kind: "mono",
      render: (item) =>
        formatPrice(typeof item.price === "number" ? item.price : null),
    },
    {
      key: "availability_status",
      label: "Статус",
      render: (item) => {
        const st = String(item.availability_status ?? "");
        const label =
          AVAILABILITY_LABELS[st as keyof typeof AVAILABILITY_LABELS] ?? st;
        return <span className={"badge badge-" + st}>{label}</span>;
      },
    },
    ACTIVE_COL,
    SORT_COL,
  ],
};
