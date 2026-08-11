// Перевод машинных кодов ошибок API в понятные русские сообщения.
// Источник — ApiError.data (сырой detail): строка-код, pydantic-массив 422
// или объект вида {code: "media_in_use", used_by: [...]}.

import { ApiError } from "./api";

// Строковые коды detail → русские тексты.
const CODE_MESSAGES: Record<string, string> = {
  slug_exists: "Такой адрес уже занят другой записью",
  conflict: "Конфликт данных — обновите страницу и повторите",
  policy_required:
    "Это единственная активная Политика конфиденциальности — на неё ссылаются формы сайта (152-ФЗ). Сначала назначьте Политикой другой документ",
  telegram_not_configured:
    "Бот не настроен: задайте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID на сервере",
  telegram_send_failed:
    "Telegram не принял сообщение — проверьте токен бота и chat_id",
  not_found: "Запись не найдена — возможно, её уже удалили",
  path_exists: "Редирект с таким адресом «откуда» уже существует",
  redirect_to_self: "Адреса «откуда» и «куда» совпадают после нормализации (слэш в конце не учитывается)",
};

// msg-коды pydantic-валидаторов → русские фразы (для 422).
const PYDANTIC_MSGS: Record<string, string> = {
  min_down_payment_gt_max: "минимальный первый взнос больше максимального",
  term_min_gt_max: "минимальный срок больше максимального",
};

interface UsedBy {
  type?: string;
  id?: string;
  title?: string;
}

const USED_BY_TYPES: Record<string, string> = {
  news: "новость",
  document: "документ",
  documents: "документ",
  floorplan: "планировка",
  floorplans: "планировка",
  advantage: "преимущество",
  advantages: "преимущество",
  partner: "партнёр",
  partners: "партнёр",
  team: "сотрудник",
  banner: "баннер",
  seo: "SEO-запись",
};

function usedByLabel(u: UsedBy): string {
  const type = u.type ? USED_BY_TYPES[u.type] ?? u.type : "";
  const title = u.title ? `«${u.title}»` : u.id ?? "";
  return [type, title].filter(Boolean).join(" ");
}

// pydantic-422: [{loc, msg, type, ...}] → «Проверьте: …» одним сообщением.
function translate422(data: unknown): string | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  const parts: string[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const msg = String((item as { msg?: unknown }).msg ?? "");
    let translated: string | null = null;
    for (const [code, text] of Object.entries(PYDANTIC_MSGS)) {
      if (msg.includes(code)) {
        translated = text;
        break;
      }
    }
    if (translated) {
      parts.push(translated);
    } else if (msg) {
      const clean = msg.replace(/^Value error,\s*/i, "");
      // Машинные коды из model_validator (redirect_to_self и т.п.) —
      // переводим по общему словарю, а не показываем как есть.
      if (CODE_MESSAGES[clean]) {
        parts.push(CODE_MESSAGES[clean]);
        continue;
      }
      // Общий случай: поле из loc + исходный msg без префикса "Value error, ".
      // Технический loc "body" пользователю ни о чём не говорит — опускаем.
      const loc = (item as { loc?: unknown }).loc;
      const field =
        Array.isArray(loc) && loc.length ? String(loc[loc.length - 1]) : "";
      parts.push(field && field !== "body" ? `${field}: ${clean}` : clean);
    }
  }
  if (parts.length === 0) return null;
  return `Проверьте: ${parts.join("; ")}`;
}

/**
 * Ошибка загрузки записи означает «записи нет»: 404 или 422 от разбора
 * некорректного id в пути (uuid_parsing). Для форм: показать человеческое
 * «Запись не найдена…» вместо машинного кода.
 */
export function isNotFoundError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  if (err.status === 404) return true;
  if (err.status === 422 && Array.isArray(err.data)) {
    return err.data.some(
      (item) =>
        item &&
        typeof item === "object" &&
        String((item as { type?: unknown }).type ?? "").includes("uuid_parsing")
    );
  }
  return false;
}

/**
 * Человеческое сообщение об ошибке API.
 * Понимает строковые коды, pydantic-422 и {code: "media_in_use", used_by}.
 */
export function translateApiError(err: unknown, fallback = "Ошибка"): string {
  if (!(err instanceof ApiError)) {
    return err instanceof Error ? err.message : fallback;
  }
  const data = err.data;

  if (typeof data === "string" && CODE_MESSAGES[data]) {
    return CODE_MESSAGES[data];
  }

  if (data && typeof data === "object" && !Array.isArray(data)) {
    const obj = data as { code?: unknown; used_by?: unknown };
    if (obj.code === "media_in_use") {
      const usedBy = Array.isArray(obj.used_by)
        ? (obj.used_by as UsedBy[]).map(usedByLabel).filter(Boolean)
        : [];
      return usedBy.length
        ? `Файл используется в: ${usedBy.join(", ")}. Сначала уберите его из этих записей`
        : "Файл используется в записях сайта — сначала уберите его оттуда";
    }
    if (typeof obj.code === "string" && CODE_MESSAGES[obj.code]) {
      return CODE_MESSAGES[obj.code];
    }
  }

  if (err.status === 422) {
    const msg = translate422(data);
    if (msg) return msg;
  }

  return err.message || fallback;
}
