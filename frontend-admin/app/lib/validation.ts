// Клиентская валидация форм: все ошибки разом (map key → текст).
// Значения number-полей проверяются в ЕДИНИЦАХ UI (percent-поля — в процентах).

import type { FieldDef } from "./resources";

/** HTML без видимого содержимого (пустой richtext: «<p><br></p>» и т.п.). */
export function isEmptyHtml(html: string): boolean {
  return (
    html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/gi, " ")
      .trim() === ""
  );
}

/**
 * Разбор «человеческого» числа: «8,5», «5 000 000» (пробелы/NBSP из Excel),
 * запятая как десятичный разделитель. Пустая строка и мусор → NaN.
 * Единый парсер для validateFields и buildPayload — никаких молчаливых
 * затираний значения null-ом.
 */
export function parseDecimal(s: string): number {
  const cleaned = s.replace(/\s+/g, "").replace(",", ".");
  if (cleaned === "") return NaN;
  return Number(cleaned);
}

/** Формат полного URL с протоколом (для полей type: "url"). */
const URL_RE = /^https?:\/\/\S+$/i;

/** Похоже на голый домен без протокола («sberbank.ru», «www.x.com/path»). */
export function looksLikeBareDomain(s: string): boolean {
  return /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(s);
}

/** Проверка всех полей формы: возвращает map «ключ поля → текст ошибки». */
export function validateFields(
  fields: FieldDef[],
  form: Record<string, string | boolean>
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const f of fields) {
    if (f.type === "checkbox") continue;
    const raw = String(form[f.key] ?? "");
    const empty =
      f.type === "richtext" ? isEmptyHtml(raw) : raw.trim() === "";

    if (f.required && empty) {
      errors[f.key] = "Заполните это поле";
      continue;
    }
    if (empty) continue;

    if (f.pattern && !f.pattern.test(raw.trim())) {
      errors[f.key] = f.patternHint ?? "Недопустимый формат значения";
      continue;
    }

    if (f.type === "url" && !URL_RE.test(raw.trim())) {
      errors[f.key] =
        "Укажите полный адрес с https://, напр. https://sberbank.ru";
      continue;
    }

    if (f.type === "number") {
      const n = parseDecimal(raw.trim());
      if (Number.isNaN(n)) {
        errors[f.key] = "Введите число";
        continue;
      }
      if (f.min !== undefined && n < f.min) {
        errors[f.key] = `Значение не может быть меньше ${f.min}`;
        continue;
      }
      if (f.max !== undefined && n > f.max) {
        errors[f.key] = `Значение не может быть больше ${f.max}`;
        continue;
      }
      // step="1" — целочисленное поле (сроки, этаж, порядок). Без нативного
      // input type=number это единственное место, где дробь ловится до
      // сохранения: иначе бэкенд вернул бы английскую ошибку pydantic.
      if (f.step === "1" && !Number.isInteger(n)) {
        errors[f.key] = "Введите целое число";
        continue;
      }
    }
  }

  return errors;
}
