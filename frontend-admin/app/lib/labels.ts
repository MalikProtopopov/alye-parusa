// Человекочитаемые русские подписи для значений API.

import type { Availability, LeadStatus } from "./types";

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Новая",
  in_progress: "В работе",
  done: "Завершена",
};

export const LEAD_STATUS_ORDER: LeadStatus[] = ["new", "in_progress", "done"];

// kind не ограничен на выходе (str), поэтому берём известные и fallback.
export const LEAD_KIND_LABELS: Record<string, string> = {
  simple_callback: "Обратный звонок",
  with_calc: "С расчётом",
  without_calc: "Без расчёта",
  presentation: "Презентация",
  floorplan: "По планировке",
};

export function leadKindLabel(kind: string): string {
  return LEAD_KIND_LABELS[kind] || kind;
}

// Блок сайта, из которого пришла заявка. Значения задаёт web/ при отправке
// формы; незнакомые показываем как есть — заявку важнее не потерять, чем
// красиво подписать.
export const LEAD_SOURCE_LABELS: Record<string, string> = {
  cta: "Форма внизу страницы",
  calculator: "Калькулятор рассрочки",
  catalog: "Каталог планировок",
  floorplan_detail: "Страница планировки",
  floorplans: "Планировки на главной",
  residences: "Апартаменты",
  hero: "Первый экран",
};

export function leadSourceLabel(block?: string | null): string {
  if (!block) return "—";
  return LEAD_SOURCE_LABELS[block] || block;
}

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  available: "В продаже",
  reserved: "Бронь",
  sold: "Продано",
};

export const AVAILABILITY_ORDER: Availability[] = [
  "available",
  "reserved",
  "sold",
];

export const ROLE_LABELS: Record<string, string> = {
  admin: "Суперадмин",
  manager: "Менеджер",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] || role;
}

// Русская плюрализация: pluralRu(3, "заявка", "заявки", "заявок") → «заявки».
export function pluralRu(
  n: number,
  one: string,
  few: string,
  many: string
): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

// Длина «как её видит редактор»: графемы (Intl.Segmenter), а не UTF-16-единицы
// — эмодзи и флаги считаются за один символ; fallback — кодпоинты. Общая
// функция для счётчика поля и предпросмотра сниппета: иначе на одном и том же
// тексте они показывали бы разные цифры и разные предупреждения о лимите.
const graphemeSegmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter("ru", { granularity: "grapheme" })
    : null;

export function countGraphemes(value: string): number {
  if (graphemeSegmenter) {
    return Array.from(graphemeSegmenter.segment(value)).length;
  }
  return [...value].length;
}

/** Нормализация строки для поиска: регистр + «ё» ≡ «е».
 *  Одна и та же логика во всех разделах — «Алёна» находится по «Алена». */
export function normalizeSearch(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е");
}

// Форматирование даты (ISO → локальная строка).
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Форматирование цены (₽) с разделителями разрядов.
export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("ru-RU") + " ₽";
}

// ISO-дата → значение для <input type="datetime-local"> (локальное время).
export function isoToDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

// Значение datetime-local (локальное время) → ISO для отправки на бэкенд.
export function datetimeLocalToIso(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString();
}
